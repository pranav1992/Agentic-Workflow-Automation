"""Backfill NULL tenant_id on pre-existing rows.

Tenant scoping was added after Workflow/Agent/Tool/Edge/PositionNode/
NodeConfig rows already existed with tenant_id left NULL (nothing ever
set it). Every read is now filtered by tenant_id, so without this,
existing rows become permanently invisible to everyone the moment that
filtering ships — not just inaccessible to other tenants, but gone for
the tenant that actually owns them.

Only safe to run when there's exactly one tenant with any NULL-tenant
data — if there were ever multiple tenants before this migration, this
can't know which tenant a given NULL row belonged to, and guessing wrong
would leak that tenant's data.

Usage:
    python scripts/backfill_tenant_id.py --tenant-slug voiceorchid
"""
import argparse

from sqlmodel import Session

from app.infrastructure.db.engine import engine
from app.infrastructure.db.auth_models import Tenant
from app.infrastructure.db.models import (
    WorkFlow, Agent, Tool, Edge, PositionNode, NodeConfig
)

MODELS = [WorkFlow, Agent, Tool, Edge, PositionNode, NodeConfig]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tenant-slug", required=True)
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Report counts without writing anything.",
    )
    args = parser.parse_args()

    with Session(engine) as session:
        tenant_count = session.query(Tenant).count()
        if tenant_count > 1:
            raise SystemExit(
                f"Refusing to backfill: {tenant_count} tenants exist. "
                "This script only knows how to assign orphaned rows to a "
                "single tenant safely — do this by hand instead."
            )

        tenant = session.query(Tenant).filter(
            Tenant.slug == args.tenant_slug
        ).first()
        if tenant is None:
            raise SystemExit(f"No tenant with slug {args.tenant_slug!r}")

        for model in MODELS:
            rows = session.query(model).filter(
                model.tenant_id.is_(None)
            ).all()
            print(f"{model.__tablename__}: {len(rows)} row(s) to backfill")
            if not args.dry_run:
                for row in rows:
                    row.tenant_id = tenant.id
                    session.add(row)

        if args.dry_run:
            print("Dry run — nothing written.")
        else:
            session.commit()
            print(f"Backfilled onto tenant {tenant.slug} ({tenant.id})")


if __name__ == "__main__":
    main()
