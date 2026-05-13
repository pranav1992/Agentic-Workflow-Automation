from livekit.agents import Agent
from agents.prompts.prompts import INSTRUCTIONS, WELCOME_MESSAGE


class VoiceOrchidAgent(Agent):
    def __init__(
        self,
        instructions: str = INSTRUCTIONS,
        welcome_message: str = WELCOME_MESSAGE,
    ):
        super().__init__(instructions=instructions)
        self._welcome_message = welcome_message

    async def on_enter(self) -> None:
        await self.session.generate_reply(instructions=self._welcome_message)
