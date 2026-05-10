from sqlmodel import SQLModel, Session, create_engine
from ...config import settings
import app.infrastructure.db.auth_models  # noqa: F401 — registers Tenant/User tables in SQLModel metadata
import app.infrastructure.db.models  # noqa: F401 — registers all domain tables


DATABASE_URL = (
    f"postgresql+psycopg2://{settings.POSTGRES_USER}:"
    f"{settings.POSTGRES_PASSWORD}@"
    f"{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/"
    f"{settings.POSTGRES_DB}"
)

engine = create_engine(DATABASE_URL, echo=True)


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
