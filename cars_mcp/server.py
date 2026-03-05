from fastmcp import FastMCP
from contextlib import asynccontextmanager
from cars_mcp.db.engine import create_db_and_tables


@asynccontextmanager
async def lifespan(mcp: FastMCP):
    print("Starting MCP server...")
    create_db_and_tables()
    yield

mcp = FastMCP(lifespan=lifespan)


@mcp.tool
def greet(name: str) -> str:
    return f"Hello, {name}!"


if __name__ == "__main__":
    mcp.run()
