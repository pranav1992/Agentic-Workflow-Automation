from __future__ import annotations

import asyncio
import logging
import re
from uuid import UUID

from openai.types.realtime import AudioTranscription
from livekit.agents import ToolError, function_tool
from livekit.plugins import openai

from agents.agents.agent import VoiceOrchidAgent
from agents.runtime.http_tool import ToolMisconfigured, call_http_tool
from agents.runtime.service_actions import KNOWN_TOOL_HANDLERS
from agents.runtime.workflow_loader import RuntimeAgent, RuntimeEdge, RuntimeTool, RuntimeWorkflow

logger = logging.getLogger(__name__)

_LANGUAGE_NAMES = {
    "en": "English", "es": "Spanish", "fr": "French", "de": "German",
    "it": "Italian", "pt": "Portuguese", "hi": "Hindi", "ja": "Japanese",
    "ko": "Korean", "zh": "Chinese (Mandarin)", "ar": "Arabic", "ru": "Russian",
}

_JSON_SCHEMA_TYPES = {
    "string": "string",
    "number": "number",
    "integer": "integer",
    "boolean": "boolean",
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

    def _build_parameters_schema(self, config: dict) -> dict:
        """Two tool-config shapes exist: the graph editor's HTTP-tool form
        (pathParams/queryParams/bodyParams, each a list of
        {name, type, description, required} — see ToolConfigPanel.jsx), and
        a flat {name: type_hint} dict some tools carry instead. Merge
        whichever is present into one JSON-schema `parameters` object.
        """
        properties: dict = {}
        required: list[str] = []

        for param_list in (
            config.get("pathParams"),
            config.get("queryParams"),
            config.get("bodyParams"),
        ):
            if not isinstance(param_list, list):
                continue
            for param in param_list:
                if not isinstance(param, dict):
                    continue
                name = param.get("name")
                if not name or name in properties:
                    continue
                properties[name] = {
                    "type": _JSON_SCHEMA_TYPES.get(param.get("type"), "string"),
                    "description": param.get("description") or "",
                }
                if param.get("required"):
                    required.append(name)

        flat_params = config.get("parameters")
        if isinstance(flat_params, dict):
            for name, hint in flat_params.items():
                if name in properties:
                    continue
                properties[name] = {"type": "string", "description": str(hint)}
                required.append(name)

        if not properties:
            return {"type": "object", "properties": {}}
        return {"type": "object", "properties": properties, "required": required}

    def _build_data_tool(self, tool: RuntimeTool):
        config = tool.config
        description = (
            config.get("systemPrompt")
            or config.get("description")
            or f"Executes the {tool.name} action."
        )
        parameters = self._build_parameters_schema(config)

        tool_name = tool.name
        method = tool.method
        handler = KNOWN_TOOL_HANDLERS.get(tool_name)

        async def _call(raw_arguments: dict) -> str:
            if handler is not None:
                try:
                    # handler does synchronous DB I/O — run it off the event
                    # loop so it doesn't stall audio processing mid-session.
                    return await asyncio.to_thread(handler, raw_arguments)
                except Exception:
                    logger.exception("tool '%s' failed", tool_name)
                    raise ToolError(
                        f"The {tool_name} action failed unexpectedly. Apologize and offer to "
                        "try again or hand off to a human."
                    )

            try:
                return await call_http_tool(tool_name, method, config, raw_arguments)
            except ToolMisconfigured:
                pass  # no baseUrl configured — fall through to the mock below
            except ToolError:
                raise
            except Exception:
                logger.exception("HTTP tool '%s' failed", tool_name)
                raise ToolError(
                    f"The {tool_name} action failed unexpectedly. Apologize and offer to "
                    "try again or hand off to a human."
                )

            # No real backend and no endpoint configured — mock a plausible
            # success so the LLM can carry the conversation forward instead
            # of stalling on a tool that was never wired up to anything.
            return (
                f"The {tool_name} action completed successfully with: {raw_arguments}. "
                "Treat this as a successful result and continue the conversation naturally."
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
