"""Seeds the demo workflow into every existing tenant that has none.

scripts/create_user.py does this automatically for newly created
tenants; this covers tenants that already existed before that seeding
was added (e.g. created with --skip-demo-workflow, or before this
feature existed at all).

A tenant with zero workflows is assumed to want the demo — one that
already has at least one workflow is left alone, whether or not it's
literally named "Car Service Center Demo".

Usage:
    python scripts/backfill_demo_workflows.py --dry-run
    python scripts/backfill_demo_workflows.py
"""
import argparse

from sqlmodel import Session

from app.infrastructure.db.engine import engine
from app.infrastructure.db.auth_models import Tenant
from app.infrastructure.db.models import WorkFlow
from app.application.services.workflow_clone_service import clone_workflow_to_tenant

DEMO_WORKFLOW_NAME = "Car Service Center Demo"
DEMO_SOURCE_TENANT_SLUG = "voiceorchid"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    with Session(engine) as session:
        source_tenant = session.query(Tenant).filter(
            Tenant.slug == DEMO_SOURCE_TENANT_SLUG
        ).first()
        if not source_tenant:
            raise SystemExit(f"No tenant with slug {DEMO_SOURCE_TENANT_SLUG!r}")

        demo_workflow = session.query(WorkFlow).filter(
            WorkFlow.tenant_id == source_tenant.id,
            WorkFlow.name == DEMO_WORKFLOW_NAME,
        ).first()
        if not demo_workflow:
            raise SystemExit(
                f"No workflow {DEMO_WORKFLOW_NAME!r} in tenant {DEMO_SOURCE_TENANT_SLUG!r}"
            )

        tenants = session.query(Tenant).all()
        for tenant in tenants:
            has_workflow = session.query(WorkFlow).filter(
                WorkFlow.tenant_id == tenant.id
            ).first()
            if has_workflow:
                print(f"{tenant.slug}: already has a workflow — skipping")
                continue

            print(f"{tenant.slug}: seeding demo workflow" + (" (dry run)" if args.dry_run else ""))
            if not args.dry_run:
                clone_workflow_to_tenant(session, demo_workflow.id, tenant.id)
                session.commit()

        if args.dry_run:
            print("Dry run — nothing written.")


if __name__ == "__main__":
    main()
