from livekit.agents import Agent
from agents.prompts.prompts import INSTRUCTIONS


class VoiceOrchidAgent(Agent):
    def __init__(self, instructions: str = INSTRUCTIONS):
        super().__init__(instructions=instructions)
