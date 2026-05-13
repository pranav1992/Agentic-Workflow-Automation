from livekit.agents import Agent
from agents.prompts.prompts import INSTRUCTIONS, WELCOME_MESSAGE


class VoiceOrchidAgent(Agent):
    def __init__(self, instructions: str = INSTRUCTIONS):
        super().__init__(instructions=instructions)

    async def on_enter(self) -> None:
        await self.session.generate_reply(instructions=WELCOME_MESSAGE)
