from __future__ import annotations

import json
import logging

from dotenv import load_dotenv, find_dotenv
from livekit import agents
from livekit.agents import AutoSubscribe, JobContext, AgentSession

from agents.prompts.prompts import INSTRUCTIONS, WELCOME_MESSAGE
from agents.agents.agent import VoiceOrchidAgent
from agents.runtime.workflow_loader import WorkflowLoader, RuntimeAgent
from agents.runtime.agent_factory import AgentFactory

load_dotenv(find_dotenv(".env.local", usecwd=True) or find_dotenv(".env", usecwd=True))

logger = logging.getLogger(__name__)

_DEFAULT_AGENT = RuntimeAgent(
    id=None,
    name="default",
    is_initial=True,
    instructions=INSTRUCTIONS,
    welcome_message=WELCOME_MESSAGE,
    model="gpt-4o-realtime-preview",
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
    try:
        await session.start(room=ctx.room, agent=agent)
    except Exception:
        logger.exception("AgentSession ended with an error (room may have been deleted)")


def _parse_workflow_id(metadata: str | None) -> str | None:
    if not metadata:
        return None
    try:
        data = json.loads(metadata)
        return data.get("workflow_id")
    except (json.JSONDecodeError, AttributeError):
        return None


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
