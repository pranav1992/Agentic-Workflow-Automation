from __future__ import annotations

import json
import logging

from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AutoSubscribe, JobContext, AgentSession
from livekit.plugins import openai

from agents.prompts.prompts import INSTRUCTIONS, WELCOME_MESSAGE
from agents.agents.agent import VoiceOrchidAgent
from agents.runtime.workflow_loader import WorkflowLoader
from agents.runtime.agent_factory import AgentFactory

load_dotenv()

logger = logging.getLogger(__name__)


async def entrypoint(ctx: JobContext):
    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)
    await ctx.wait_for_participant()

    # --- Resolve agent config from workflow (if room metadata carries workflow_id) ---
    agent_instructions = INSTRUCTIONS
    agent_model = "gpt-4o-realtime-preview"
    agent_temperature = 0.7

    workflow_id = _parse_workflow_id(ctx.room.metadata)
    if workflow_id:
        try:
            runtime_workflow = WorkflowLoader().load(workflow_id)
            initial = runtime_workflow.initial_agent
            if initial:
                agent_instructions = initial.instructions
                agent_model = initial.model
                agent_temperature = initial.temperature
                logger.info(
                    "Loaded workflow '%s', starting with agent '%s'",
                    runtime_workflow.name,
                    initial.name,
                )
            else:
                logger.warning(
                    "Workflow %s has no initial agent — using defaults", workflow_id
                )
        except Exception:
            logger.exception("Failed to load workflow %s — using defaults", workflow_id)

    # --- Build LiveKit session ---
    llm = openai.realtime.RealtimeModel(
        model=agent_model,
        voice="marin",
        temperature=agent_temperature,
        modalities=["audio", "text"],
    )
    session = AgentSession(llm=llm)
    await session.start(
        room=ctx.room,
        agent=VoiceOrchidAgent(instructions=agent_instructions),
    )
    await session.generate_reply(instructions=WELCOME_MESSAGE)


def _parse_workflow_id(metadata: str | None) -> str | None:
    """Extract workflow_id from LiveKit room metadata JSON, e.g. {"workflow_id": "..."}."""
    if not metadata:
        return None
    try:
        data = json.loads(metadata)
        return data.get("workflow_id")
    except (json.JSONDecodeError, AttributeError):
        return None


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
