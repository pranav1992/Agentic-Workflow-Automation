"""Bootstrap a tenant + user for signing in.

There's no self-registration endpoint on purpose (this is an internal
builder tool, not a public product), so the first login has to be seeded
from here.

Usage:
    # Auto-generates a strong password and prints it once:
    python scripts/create_user.py --email you@example.com --tenant-name Acme --role admin

    # Or supply your own:
    python scripts/create_user.py --email you@example.com --password secret \
        --tenant-name Acme --role admin
"""
import argparse
import secrets
import string

from sqlmodel import Session

from app.infrastructure.db.engine import engine, create_db_and_tables
from app.infrastructure.db.auth_models import Tenant
from app.application.services.auth_service import AuthService
from app.core.constants import UserRole


def generate_password(length: int = 24) -> str:
    """A random password drawn from letters/digits/symbols — same
    approach used to generate every other bootstrap credential in this
    project, kept here so this script doesn't require inventing one."""
    alphabet = string.ascii_letters + string.digits + "!@#%^&*()-_=+"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument(
        "--password",
        default=None,
        help="Omit to auto-generate a strong password (printed once, not stored anywhere).",
    )
    parser.add_argument("--username", default=None)
    parser.add_argument("--tenant-name", default="Default")
    parser.add_argument("--tenant-slug", default="default")
    parser.add_argument(
        "--role", default="admin", choices=[r.value for r in UserRole]
    )
    args = parser.parse_args()

    password = args.password or generate_password()
    password_was_generated = args.password is None

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
            password=password,
            role=UserRole(args.role),
        )
        print(f"Created user {user.email} ({user.role}) in tenant {tenant.slug}")
        if password_was_generated:
            print(f"Generated password: {password}")
            print("Save this now — it is not stored anywhere and won't be shown again.")


if __name__ == "__main__":
    main()
