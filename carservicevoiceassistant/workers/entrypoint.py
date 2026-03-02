from __future__ import annotations
from livekit.agents import (
    AutoSubscribe, JobContext, AgentSession
)
from livekit import agents
from livekit.plugins import openai
from carservicevoiceassistant.prompts import WELCOME_MESSAGE
from carservicevoiceassistant.agents import CarServiceAssistant
from dotenv import load_dotenv

load_dotenv()


async def entrypoint(ctx: JobContext):
    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)
    await ctx.wait_for_participant()
    model = openai.realtime.RealtimeModel(
        model="gpt-realtime",
        voice="marin",
        temperature=0.7,
        modalities=["audio", "text"],
    )
    session = AgentSession(
        llm=model
    )
    await session.start(
        room=ctx.room,
        agent=CarServiceAssistant()
    )
    await session.generate_reply(
        instructions=WELCOME_MESSAGE
    )

if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
