from __future__ import annotations

from openai.types.realtime import AudioTranscription
from livekit.plugins import openai

from agents.agents.agent import VoiceOrchidAgent
from agents.runtime.workflow_loader import RuntimeAgent

_LANGUAGE_NAMES = {
    "en": "English", "es": "Spanish", "fr": "French", "de": "German",
    "it": "Italian", "pt": "Portuguese", "hi": "Hindi", "ja": "Japanese",
    "ko": "Korean", "zh": "Chinese (Mandarin)", "ar": "Arabic", "ru": "Russian",
}


class AgentFactory:
    """Builds a LiveKit VoiceOrchidAgent from a RuntimeAgent dataclass."""

    def build(self, runtime_agent: RuntimeAgent) -> VoiceOrchidAgent:
        instructions = runtime_agent.instructions
        if runtime_agent.language and runtime_agent.language != "en":
            lang_name = _LANGUAGE_NAMES.get(runtime_agent.language, runtime_agent.language)
            instructions = f"Always respond in {lang_name}.\n\n{instructions}"
        return VoiceOrchidAgent(instructions=instructions)

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
