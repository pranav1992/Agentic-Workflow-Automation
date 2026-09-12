"""Bootstrap a tenant + user for signing in.

There's no self-registration endpoint on purpose (this is an internal
builder tool, not a public product), so the first login has to be seeded
from here.

Usage:
    python scripts/create_user.py --email you@example.com --password secret \
        --tenant-name Acme --role admin
"""
import argparse

from sqlmodel import Session

from app.infrastructure.db.engine import engine, create_db_and_tables
from app.infrastructure.db.auth_models import Tenant
from app.application.services.auth_service import AuthService
from app.core.constants import UserRole


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--username", default=None)
    parser.add_argument("--tenant-name", default="Default")
    parser.add_argument("--tenant-slug", default="default")
    parser.add_argument(
        "--role", default="admin", choices=[r.value for r in UserRole]
    )
    args = parser.parse_args()

    create_db_and_tables()

    with Session(engine) as session:
        tenant = session.query(Tenant).filter(
            Tenant.slug == args.tenant_slug
        ).first()
        if not tenant:
            tenant = Tenant(name=args.tenant_name, slug=args.tenant_slug)
            session.add(tenant)
            session.commit()
            session.refresh(tenant)

        auth_service = AuthService(session)
        user = auth_service.create_user(
            tenant_id=tenant.id,
            email=args.email,
            username=args.username or args.email.split("@")[0],
            password=args.password,
            role=UserRole(args.role),
        )
        print(f"Created user {user.email} ({user.role}) in tenant {tenant.slug}")


if __name__ == "__main__":
    main()
