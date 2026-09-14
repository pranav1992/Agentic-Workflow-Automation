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
from app.infrastructure.db.models import WorkFlow
from app.application.services.auth_service import AuthService
from app.application.services.workflow_clone_service import clone_workflow_to_tenant
from app.core.constants import UserRole

# Every brand-new tenant gets its own copy of this workflow, so a new
# user never lands on an empty "no workflows yet" screen. Looked up by
# name within DEMO_SOURCE_TENANT_SLUG — the one tenant that actually
# owns the canonical copy — not shared across tenants, since tenant data
# is fully isolated (see app/application/services/workflow_clone_service.py).
DEMO_WORKFLOW_NAME = "Car Service Center Demo"
DEMO_SOURCE_TENANT_SLUG = "voiceorchid"


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
    parser.add_argument(
        "--skip-demo-workflow",
        action="store_true",
        help="Don't seed the demo workflow into a newly created tenant.",
    )
    args = parser.parse_args()

    password = args.password or generate_password()
    password_was_generated = args.password is None

    create_db_and_tables()

    with Session(engine) as session:
        tenant = session.query(Tenant).filter(
            Tenant.slug == args.tenant_slug
        ).first()
        is_new_tenant = tenant is None
        if not tenant:
            tenant = Tenant(name=args.tenant_name, slug=args.tenant_slug)
            session.add(tenant)
            session.commit()
            session.refresh(tenant)

        if is_new_tenant and not args.skip_demo_workflow:
            source_tenant = session.query(Tenant).filter(
                Tenant.slug == DEMO_SOURCE_TENANT_SLUG
            ).first()
            demo_workflow = None
            if source_tenant:
                demo_workflow = session.query(WorkFlow).filter(
                    WorkFlow.tenant_id == source_tenant.id,
                    WorkFlow.name == DEMO_WORKFLOW_NAME,
                ).first()
            if demo_workflow:
                clone_workflow_to_tenant(session, demo_workflow.id, tenant.id)
                session.commit()
                print(f"Seeded demo workflow {DEMO_WORKFLOW_NAME!r} into tenant {tenant.slug}")
            else:
                print(
                    f"Note: demo workflow {DEMO_WORKFLOW_NAME!r} not found in tenant "
                    f"{DEMO_SOURCE_TENANT_SLUG!r} — skipping seed."
                )

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
