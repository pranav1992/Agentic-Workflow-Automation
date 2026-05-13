import json
from datetime import datetime
from uuid import UUID

from livekit import api

from app.core.settings import get_settings
from app.domain.schema import (
    WorkflowLaunchResponse,
    WorkflowSessionResponse,
    WorkflowStatusResponse,
)
from app.infrastructure.db.models import WorkflowSession
from app.infrastructure.repository.session_repository import SessionRepository


class SessionService:
    def __init__(self, session_repository: SessionRepository):
        self.repo = session_repository
        self._settings = get_settings()

    def _lk_client(self) -> api.LiveKitAPI:
        return api.LiveKitAPI(
            url=self._settings.LIVEKIT_URL,
            api_key=self._settings.LIVEKIT_API_KEY,
            api_secret=self._settings.LIVEKIT_API_SECRET,
        )

    async def launch(self, workflow_id: UUID) -> WorkflowLaunchResponse:
        room_name = f"workflow-{workflow_id}"
        metadata = json.dumps({"workflow_id": str(workflow_id)})

        lk = self._lk_client()
        await lk.room.create_room(
            api.CreateRoomRequest(name=room_name, metadata=metadata)
        )
        await lk.aclose()

        token = (
            api.AccessToken(
                self._settings.LIVEKIT_API_KEY,
                self._settings.LIVEKIT_API_SECRET,
            )
            .with_identity("user")
            .with_name("User")
            .with_grants(api.VideoGrants(room_join=True, room=room_name))
            .to_jwt()
        )

        session = WorkflowSession(
            workflow_id=workflow_id,
            room_name=room_name,
            status="active",
        )
        session = self.repo.create(session)

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

        lk = self._lk_client()
        try:
            await lk.room.delete_room(
                api.DeleteRoomRequest(room=session.room_name)
            )
        except Exception:
            pass  # room may already be gone
        finally:
            await lk.aclose()

        session.status = "stopped"
        session.ended_at = datetime.now()
        self.repo.update(session)

    def get_status(self, workflow_id: UUID) -> WorkflowStatusResponse:
        session = self.repo.get_active(workflow_id)
        if session is None:
            return WorkflowStatusResponse(status="idle")
        return WorkflowStatusResponse(
            status="active",
            session_id=session.id,
            room_name=session.room_name,
            started_at=session.started_at,
        )

    def get_sessions(self, workflow_id: UUID) -> list[WorkflowSessionResponse]:
        sessions = self.repo.get_all(workflow_id)
        return [WorkflowSessionResponse.from_orm_with_duration(s) for s in sessions]
