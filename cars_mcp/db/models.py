from sqlmodel import SQLModel
from sqlmodel import Field

class Car(SQLModel, table=True):
    vin: str = Field(primary_key=True, index=True)
    make: str
    model: str
    year: int