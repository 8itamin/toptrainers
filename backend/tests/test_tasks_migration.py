from __future__ import annotations

from alembic.config import Config
from alembic.script import ScriptDirectory


def test_program_tasks_migration_is_the_current_head() -> None:
    scripts = ScriptDirectory.from_config(Config("alembic.ini"))

    assert scripts.get_current_head() == "20260922_0012"
