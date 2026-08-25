"""sync_users_and_scans

Revision ID: 6d0ccf0c9a8e
Revises: 
Create Date: 2026-08-24 07:59:32.028995

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '6d0ccf0c9a8e'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add forgot-password fields to users and soft-delete fields to security_scans."""
    # users: password reset support
    op.add_column('users', sa.Column('reset_token', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('reset_token_expires', sa.DateTime(), nullable=True))

    # security_scans: soft delete support
    op.add_column('security_scans', sa.Column('is_deleted', sa.Boolean(), nullable=True))
    op.add_column('security_scans', sa.Column('deleted_at', sa.DateTime(), nullable=True))
    op.add_column('security_scans', sa.Column('deleted_by', sa.UUID(), nullable=True))
    op.add_column('security_scans', sa.Column('deletion_reason', sa.String(length=255), nullable=True))
    op.create_foreign_key(
        'fk_scans_deleted_by_users', 'security_scans', 'users',
        ['deleted_by'], ['id'], ondelete='SET NULL',
    )


def downgrade() -> None:
    """Reverse the above changes."""
    op.drop_constraint('fk_scans_deleted_by_users', 'security_scans', type_='foreignkey')
    op.drop_column('security_scans', 'deletion_reason')
    op.drop_column('security_scans', 'deleted_by')
    op.drop_column('security_scans', 'deleted_at')
    op.drop_column('security_scans', 'is_deleted')

    op.drop_column('users', 'reset_token_expires')
    op.drop_column('users', 'reset_token')
