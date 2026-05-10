from __future__ import annotations

from livekit.plugins import openai

from agents.agents.agent import VoiceOrchidAgent
from agents.runtime.workflow_loader import RuntimeAgent


class AgentFactory:
    """Builds a LiveKit VoiceOrchidAgent from a RuntimeAgent dataclass."""

    def build(self, runtime_agent: RuntimeAgent) -> VoiceOrchidAgent:
        return VoiceOrchidAgent(instructions=runtime_agent.instructions)

    def build_realtime_model(
        self, runtime_agent: RuntimeAgent
    ) -> openai.realtime.RealtimeModel:
        return openai.realtime.RealtimeModel(
            model=runtime_agent.model,
            voice="marin",
            temperature=runtime_agent.temperature,
            modalities=["audio", "text"],
        )
