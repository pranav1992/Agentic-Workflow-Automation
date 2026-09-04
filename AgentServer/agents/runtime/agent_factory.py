from __future__ import annotations

import asyncio
import logging
import re
from uuid import UUID

from openai.types.realtime import AudioTranscription
from livekit.agents import ToolError, function_tool
from livekit.plugins import openai

from agents.agents.agent import VoiceOrchidAgent
from agents.runtime.service_actions import KNOWN_TOOL_HANDLERS
from agents.runtime.workflow_loader import RuntimeAgent, RuntimeEdge, RuntimeTool, RuntimeWorkflow

logger = logging.getLogger(__name__)

_LANGUAGE_NAMES = {
    "en": "English", "es": "Spanish", "fr": "French", "de": "German",
    "it": "Italian", "pt": "Portuguese", "hi": "Hindi", "ja": "Japanese",
    "ko": "Korean", "zh": "Chinese (Mandarin)", "ar": "Arabic", "ru": "Russian",
}


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", name).strip("_").lower()
    return slug or "agent"


class AgentFactory:
    """Builds LiveKit VoiceOrchidAgent(s) from RuntimeAgent dataclasses."""

    def build(self, runtime_agent: RuntimeAgent) -> VoiceOrchidAgent:
        instructions = runtime_agent.instructions
        if runtime_agent.language and runtime_agent.language != "en":
            lang_name = _LANGUAGE_NAMES.get(runtime_agent.language, runtime_agent.language)
            instructions = f"Always respond in {lang_name}.\n\n{instructions}"
        return VoiceOrchidAgent(
            instructions=instructions,
            welcome_message=runtime_agent.welcome_message,
        )

    def build_realtime_model(
        self, runtime_agent: RuntimeAgent
    ) -> openai.realtime.RealtimeModel:
        return openai.realtime.RealtimeModel(
            model=runtime_agent.model,
            voice="marin",
            modalities=["audio", "text"],
            input_audio_transcription=AudioTranscription(
                model="gpt-4o-transcribe",
                language=runtime_agent.language or "en",
            ),
        )

    async def build_graph(self, workflow: RuntimeWorkflow) -> VoiceOrchidAgent:
        """Builds every agent in the workflow and wires each one up with:
        - a function tool per RuntimeTool attached to it (mocked execution —
          there's no real backend behind book_appointment/etc. yet), and
        - a handoff tool per outgoing edge, so the LLM can transfer the call
          to the next agent by calling a function rather than the graph
          being purely descriptive metadata.

        Returns the workflow's initial agent; the rest are reachable from it
        (and each other) via the handoff tools.
        """
        registry: dict[UUID, VoiceOrchidAgent] = {
            runtime_agent.id: self.build(runtime_agent) for runtime_agent in workflow.agents
        }

        for runtime_agent in workflow.agents:
            agent = registry[runtime_agent.id]
            tools = [self._build_data_tool(tool) for tool in runtime_agent.tools]
            for target, edge in workflow.successors(runtime_agent):
                tools.append(self._build_handoff_tool(target, edge, registry))
            if tools:
                await agent.update_tools(tools)

        initial = workflow.initial_agent
        if initial is not None:
            return registry[initial.id]
        return next(iter(registry.values()))

    def _build_data_tool(self, tool: RuntimeTool):
        description = tool.config.get("description") or f"Executes the {tool.name} action."
        raw_params = tool.config.get("parameters")
        if isinstance(raw_params, dict) and raw_params:
            properties = {
                param_name: {"type": "string", "description": str(param_desc)}
                for param_name, param_desc in raw_params.items()
            }
            parameters: dict = {
                "type": "object",
                "properties": properties,
                "required": list(properties.keys()),
            }
        else:
            parameters = {"type": "object", "properties": {}}

        tool_name = tool.name
        handler = KNOWN_TOOL_HANDLERS.get(tool_name)

        async def _call(raw_arguments: dict) -> str:
            if handler is None:
                # No real backend exists for this tool — mock a successful
                # result so the LLM can carry the conversation forward
                # realistically instead of stalling on a missing integration.
                return (
                    f"The {tool_name} action completed successfully with: {raw_arguments}. "
                    "Treat this as a successful result and continue the conversation naturally."
                )
            try:
                # handler does synchronous DB I/O — run it off the event
                # loop so it doesn't stall audio processing for the session.
                return await asyncio.to_thread(handler, raw_arguments)
            except Exception:
                logger.exception("tool '%s' failed", tool_name)
                raise ToolError(
                    f"The {tool_name} action failed unexpectedly. Apologize and offer to try again "
                    "or hand off to a human."
                )

        return function_tool(
            _call,
            raw_schema={
                "name": tool_name,
                "description": description,
                "parameters": parameters,
            },
        )

    def _build_handoff_tool(
        self, target: RuntimeAgent, edge: RuntimeEdge, registry: dict[UUID, VoiceOrchidAgent]
    ):
        tool_name = f"transfer_to_{_slugify(target.name)}"
        description = edge.condition or f"Transfer the call to {target.name}."
        target_id = target.id
        target_name = target.name

        async def _handoff() -> tuple[str, VoiceOrchidAgent]:
            return f"Transferring you to {target_name}.", registry[target_id]

        return function_tool(_handoff, name=tool_name, description=description)
