import json
import logging
import secrets
import time
from collections import deque
from datetime import datetime, timedelta
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from livekit import api

from app.core.settings import get_settings
from app.domain.schema import (
    WorkflowLaunchResponse,
    WorkflowSessionResponse,
    WorkflowStatusResponse,
)
from app.infrastructure.db.models import WorkflowSession
from app.infrastructure.repository.session_repository import SessionRepository


logger = logging.getLogger(__name__)

# Launch timestamps per client IP, for the sliding-window rate limit below.
# In-process is sufficient while the API runs as a single container; this must
# move to Redis/Postgres before scaling the API horizontally, or each replica
# will enforce its own separate allowance.
_launch_history: dict[str, deque] = {}


class SessionService:
    def __init__(self, session_repository: SessionRepository):
        self.repo = session_repository
        self._settings = get_settings()

    def _enforce_launch_limits(self, client_ip: str | None) -> None:
        """Bounds what an anonymous caller can spend.

        /launch is deliberately public so anyone can try the demo, and every
        session is a live OpenAI Realtime audio stream billed per second — so
        these two caps are the only thing standing between a scripted loop and
        an unbounded bill.
        """
        active = self.repo.count_active()
        if active >= self._settings.MAX_CONCURRENT_SESSIONS:
            logger.warning(
                "launch refused: concurrency cap reached (%d active)", active
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    "All demo lines are busy right now. "
                    "Please try again in a few minutes."
                ),
            )

        if not client_ip:
            return

        window = self._settings.LAUNCH_LIMIT_WINDOW_SECONDS
        limit = self._settings.LAUNCH_LIMIT_PER_IP
        now = time.monotonic()

        history = _launch_history.setdefault(client_ip, deque())
        while history and now - history[0] > window:
            history.popleft()

        if len(history) >= limit:
            logger.warning("launch refused: rate limit for ip=%s", client_ip)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"Too many demo sessions started from this network "
                    f"({limit} per {window // 60} minutes). "
                    "Please try again later."
                ),
            )

        history.append(now)

    def _lk_client(self) -> api.LiveKitAPI:
        return api.LiveKitAPI(
            url=self._settings.LIVEKIT_URL,
            api_key=self._settings.LIVEKIT_API_KEY,
            api_secret=self._settings.LIVEKIT_API_SECRET,
        )

    async def launch(
        self, workflow_id: UUID, client_ip: str | None = None
    ) -> WorkflowLaunchResponse:
        # Close out any session still marked active for this workflow first.
        # Without this, launching twice (e.g. a page refresh that missed the
        # disconnect handler) leaves two "active" rows for the same workflow;
        # get_active() then returns whichever one the DB feels like, and a
        # single /stop call can no longer reach the other — it stays "active"
        # forever even though nothing is actually running.
        stale = self.repo.get_active(workflow_id)
        if stale is not None:
            await self._end_session(stale)

        self._enforce_launch_limits(client_ip)

        # Generate session ID first so it can be embedded in the room name.
        # Using a unique room name per session guarantees LiveKit always
        # dispatches a fresh worker job — reusing the same name causes the
        # server to skip dispatch on subsequent launches of the same workflow.
        # The worker also parses the session id back out of this name so it can
        # close the row and record usage when the call ends.
        session_id = uuid4()
        room_name = f"workflow-{workflow_id}-{session_id}"
        metadata = json.dumps({"workflow_id": str(workflow_id)})

        lk = self._lk_client()
        await lk.room.create_room(
            api.CreateRoomRequest(
                name=room_name,
                metadata=metadata,
                # Server-side backstops for rooms the browser never cleans up
                # (tab crash, mobile backgrounding): LiveKit tears the room
                # down itself, which ends the worker job and stops the billing.
                empty_timeout=self._settings.ROOM_EMPTY_TIMEOUT_SECONDS,
                departure_timeout=self._settings.ROOM_DEPARTURE_TIMEOUT_SECONDS,
                # One caller plus one agent. Stops a third party who learned
                # the room name from silently joining a live call.
                max_participants=2,
            )
        )
        await lk.aclose()

        token = (
            api.AccessToken(
                self._settings.LIVEKIT_API_KEY,
                self._settings.LIVEKIT_API_SECRET,
            )
            # Random per-session identity: a fixed "user" identity means a
            # second joiner with a leaked token silently displaces the caller.
            .with_identity(f"caller-{secrets.token_urlsafe(8)}")
            .with_name("User")
            .with_grants(
                api.VideoGrants(
                    room_join=True,
                    room=room_name,
                    # Audio only — the UI uses no data channels.
                    can_publish=True,
                    can_subscribe=True,
                    can_publish_data=False,
                )
            )
            # The SDK default is ~6h; scope it to just outlive a capped session
            # so a leaked token isn't reusable for the rest of the day.
            .with_ttl(timedelta(seconds=self._settings.LIVEKIT_TOKEN_TTL_SECONDS))
            .to_jwt()
        )

        session = WorkflowSession(
            id=session_id,
            workflow_id=workflow_id,
            room_name=room_name,
            status="active",
        )
        session = self.repo.create(session)
        logger.info(
            "session launched id=%s workflow=%s ip=%s",
            session.id,
            workflow_id,
            client_ip,
        )

        return WorkflowLaunchResponse(
            session_id=session.id,
            room_name=room_name,
            token=token,
            livekit_url=self._settings.LIVEKIT_URL,
        )

    async def stop(self, workflow_id: UUID) -> None:
        session = self.repo.get_active(workflow_id)
        if session is None:
            return
        await self._end_session(session)

    async def _end_session(self, session: WorkflowSession) -> None:
        lk = self._lk_client()
        try:
            await lk.room.delete_room(
                api.DeleteRoomRequest(room=session.room_name)
            )
        except Exception:
            # The room is usually already gone (LiveKit's own empty/departure
            # timeout got there first), which is fine. But a real failure here
            # means the room — and the agent billing against it — is still
            # live while we mark the row stopped, so it must not stay silent.
            logger.exception(
                "failed to delete LiveKit room %s for session %s; "
                "it may still be running",
                session.room_name,
                session.id,
            )
        finally:
            await lk.aclose()

        session.status = "stopped"
        session.ended_at = datetime.now()
        self.repo.update(session)
        logger.info("session stopped id=%s", session.id)

    def get_status(self, workflow_id: UUID) -> WorkflowStatusResponse:
        session = self.repo.get_active(workflow_id)
        if session is None:
            return WorkflowStatusResponse(status="idle")
        # room_name is deliberately omitted: this endpoint is public, and the
        # room name is the one secret standing between a stranger and joining
        # someone else's live call.
        return WorkflowStatusResponse(
            status="active",
            session_id=session.id,
            started_at=session.started_at,
        )

    def get_sessions(self, workflow_id: UUID) -> list[WorkflowSessionResponse]:
        sessions = self.repo.get_all(workflow_id)
        return [WorkflowSessionResponse.from_orm_with_duration(s) for s in sessions]
