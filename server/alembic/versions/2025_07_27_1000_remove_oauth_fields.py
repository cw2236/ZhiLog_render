"""Remove OAuth fields from users table

Revision ID: 2025_07_27_1000
Revises: 2025_07_27_0937
Create Date: 2025-07-27 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2025_07_27_1000'
down_revision = '2025_07_27_0937'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remove OAuth related columns from users table
    op.drop_index(op.f('ix_users_provider_user_id'), table_name='users')
    op.drop_column('users', 'provider_user_id')
    op.drop_column('users', 'auth_provider')


def downgrade() -> None:
    # Add back OAuth related columns to users table
    op.add_column('users', sa.Column('auth_provider', sa.String(), nullable=False, server_default='google'))
    op.add_column('users', sa.Column('provider_user_id', sa.String(), nullable=False, server_default='temp_id'))
    op.create_index(op.f('ix_users_provider_user_id'), 'users', ['provider_user_id'], unique=False)
