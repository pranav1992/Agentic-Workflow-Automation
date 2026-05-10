from livekit.agents import Agent
from agents.prompts.prompts import INSTRUCTIONS


class CarServiceAssistant(Agent):
    def __init__(self, instructions: str = INSTRUCTIONS):
        super().__init__(instructions=instructions)
