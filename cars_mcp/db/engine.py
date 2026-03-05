from sqlmodel import SQLModel, create_engine

sqlite_file_name = "db_cars_mcp.sqlite"
sqlite_url = f"sqlite:///{sqlite_file_name}"

connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args, echo=True)


async def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    print("Created database and tables")
