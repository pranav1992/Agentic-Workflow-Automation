from __future__ import annotations

import asyncio
import dataclasses
import json
import logging
import os
from datetime import datetime
from uuid import UUID

from dotenv import load_dotenv, find_dotenv
from livekit import agents
from livekit.agents import AutoSubscribe, JobContext, AgentSession, metrics

from agents.prompts.prompts import INSTRUCTIONS, WELCOME_MESSAGE
from agents.agents.agent import VoiceOrchidAgent
from agents.runtime.workflow_loader import WorkflowLoader, RuntimeAgent
from agents.runtime.agent_factory import AgentFactory

load_dotenv(find_dotenv(".env.local", usecwd=True) or find_dotenv(".env", usecwd=True))

logger = logging.getLogger(__name__)

# Hard wall-clock ceiling on a single call. The room-level empty/departure
# timeouts only reap rooms nobody is in — they do nothing about a caller who
# stays connected (or walks away with the tab open), and every second of that
# is billed by the OpenAI Realtime API. Kept in sync with the API's
# MAX_SESSION_SECONDS default.
MAX_SESSION_SECONDS = int(os.getenv("MAX_SESSION_SECONDS", "300"))

_DEFAULT_AGENT = RuntimeAgent(
    id=None,
    name="default",
    is_initial=True,
    instructions=INSTRUCTIONS,
    welcome_message=WELCOME_MESSAGE,
    model="gpt-realtime",
    temperature=0.7,
    max_tokens=1024,
    language="en",
    position_id=None,
)


async def entrypoint(ctx: JobContext):
    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)
    await ctx.wait_for_participant()

    initial = _DEFAULT_AGENT
    runtime_workflow = None
    workflow_id = _parse_workflow_id(ctx.room.metadata)
    if workflow_id:
        try:
            loaded_workflow = WorkflowLoader().load(workflow_id)
            loaded = loaded_workflow.initial_agent
            if loaded:
                initial = loaded
                runtime_workflow = loaded_workflow
                logger.info(
                    "Loaded workflow '%s', starting with agent '%s' (lang=%s, %d agent(s), %d edge(s))",
                    runtime_workflow.name,
                    initial.name,
                    initial.language,
                    len(runtime_workflow.agents),
                    len(runtime_workflow.edges),
                )
            else:
                logger.warning("Workflow %s has no initial agent — using defaults", workflow_id)
        except Exception:
            logger.exception("Failed to load workflow %s — using defaults", workflow_id)

    factory = AgentFactory()
    llm = factory.build_realtime_model(initial)
    if runtime_workflow is not None:
        # Wires up every agent in the graph with handoff + data tools so the
        # LLM can actually transfer the call and call tools mid-session,
        # instead of the graph being purely descriptive metadata.
        agent = await factory.build_graph(runtime_workflow)
    else:
        agent = factory.build(initial)

    session = AgentSession(llm=llm)

    # Usage is the only record of what a call cost; collect it as the session
    # runs so it survives however the call ends.
    usage = metrics.UsageCollector()

    @session.on("metrics_collected")
    def _on_metrics(ev) -> None:
        usage.collect(ev.metrics)

    session_id = _parse_session_id(ctx.room.name)
    outcome = {"reason": "completed"}

    # Runs however the job ends — caller hangs up, duration cap, room deleted
    # by the API's /stop, or an error. This is what stops sessions leaking as
    # permanently "active" rows, since the browser's own stop call is
    # best-effort and never fires on a crashed or backgrounded tab.
    async def _finalize() -> None:
        _record_session_end(session_id, outcome["reason"], usage)

    ctx.add_shutdown_callback(_finalize)

    try:
        await session.start(room=ctx.room, agent=agent)
    except Exception:
        outcome["reason"] = "error"
        logger.exception("AgentSession failed to start")
        return

    # session.start() returns once the session is running, not when the call
    # ends, so block here to enforce the ceiling. If the caller leaves first,
    # the job shuts down and this sleep is simply cancelled.
    try:
        await asyncio.sleep(MAX_SESSION_SECONDS)
    except asyncio.CancelledError:
        raise

    logger.warning(
        "session %s hit the %ds duration cap — ending the call",
        session_id,
        MAX_SESSION_SECONDS,
    )
    outcome["reason"] = "duration_cap"
    try:
        await session.aclose()
    finally:
        # Deleting the room disconnects the caller and releases the job.
        await ctx.delete_room()


def _record_session_end(
    session_id: UUID | None,
    reason: str,
    usage: metrics.UsageCollector,
) -> None:
    """Closes the WorkflowSession row and stores what the call consumed.

    Deliberately never raises: this runs on the job's shutdown path, and a
    bookkeeping failure must not take down call teardown.
    """
    if session_id is None:
        return

    try:
        summary = dataclasses.asdict(usage.get_summary())
    except Exception:
        logger.exception("could not summarise usage for session %s", session_id)
        summary = None

    try:
        # Imported lazily so a worker process that never finishes a call
        # doesn't pay for the DB/ORM import at startup.
        from sqlmodel import Session

        from app.infrastructure.db.engine import engine
        from app.infrastructure.db.models import WorkflowSession

        with Session(engine) as db:
            row = db.get(WorkflowSession, session_id)
            if row is None:
                logger.warning("no session row %s to finalise", session_id)
                return
            row.usage = summary
            # /stop may have closed the row already; keep its reason and
            # timestamp but still attach the usage we collected.
            if row.status == "active":
                row.status = "stopped"
                row.ended_at = datetime.now()
                row.ended_reason = reason
            db.add(row)
            db.commit()
        logger.info("session %s finalised reason=%s", session_id, reason)
    except Exception:
        logger.exception("failed to finalise session %s", session_id)


def _parse_workflow_id(metadata: str | None) -> str | None:
    if not metadata:
        return None
    try:
        data = json.loads(metadata)
        return data.get("workflow_id")
    except (json.JSONDecodeError, AttributeError):
        return None


def _parse_session_id(room_name: str | None) -> UUID | None:
    """Room names are `workflow-{workflow_id}-{session_id}` (see
    SessionService.launch), so the trailing UUID identifies the row to close.
    """
    if not room_name:
        return None
    # A UUID is five dash-separated groups, so the session id is the last five.
    parts = room_name.split("-")
    if len(parts) < 5:
        logger.warning("could not parse session id from room name %r", room_name)
        return None
    try:
        return UUID("-".join(parts[-5:]))
    except ValueError:
        logger.warning("could not parse session id from room name %r", room_name)
        return None


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
