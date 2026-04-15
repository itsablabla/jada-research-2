"""Add REPORT document type

Revision ID: 122
Revises: 121
Create Date: 2026-04-14 00:30:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "122"
down_revision: str | None = "121"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Safely add 'REPORT' to documenttype enum if missing."""

    op.execute(
        """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_type t
            JOIN pg_enum e ON t.oid = e.enumtypid
            WHERE t.typname = 'documenttype' AND e.enumlabel = 'REPORT'
        ) THEN
            ALTER TYPE documenttype ADD VALUE 'REPORT';
        END IF;
    END
    $$;
    """
    )


def downgrade() -> None:
    """Remove 'REPORT' from documenttype enum."""
    # PostgreSQL doesn't support removing enum values directly
    pass
