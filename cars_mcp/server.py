from fastmcp import FastMCP
from contextlib import asynccontextmanager
from sqlmodel import Session, select
from cars_mcp.db.engine import engine, create_db_and_tables
from cars_mcp.db.models import Car


@asynccontextmanager
async def lifespan(mcp: FastMCP):
    print("Starting MCP server...")
    await create_db_and_tables()
    yield


mcp = FastMCP(lifespan=lifespan)


@mcp.tool
def get_car_by_vin(vin: str) -> dict:
    """Look up a vehicle by its VIN number. Returns make, model, and year if found."""
    with Session(engine) as session:
        car = session.get(Car, vin.upper())
        if car is None:
            return {"found": False, "vin": vin}
        return {
            "found": True,
            "vin": car.vin,
            "make": car.make,
            "model": car.model,
            "year": car.year,
        }


@mcp.tool
def add_car(vin: str, make: str, model: str, year: int) -> dict:
    """Register a new vehicle in the system. Use when a customer says they don't have a profile."""
    vin = vin.upper()
    with Session(engine) as session:
        existing = session.get(Car, vin)
        if existing:
            return {"success": False, "reason": "VIN already registered", "vin": vin}
        car = Car(vin=vin, make=make, model=model, year=year)
        session.add(car)
        session.commit()
        session.refresh(car)
        return {
            "success": True,
            "vin": car.vin,
            "make": car.make,
            "model": car.model,
            "year": car.year,
        }


@mcp.tool
def list_cars() -> list[dict]:
    """List all vehicles currently registered in the system."""
    with Session(engine) as session:
        cars = session.exec(select(Car)).all()
        return [
            {"vin": c.vin, "make": c.make, "model": c.model, "year": c.year}
            for c in cars
        ]


if __name__ == "__main__":
    mcp.run()
