from sqlalchemy.dialects import postgresql

from toptrainers_api.modules.clients.repository import (
    account_for_update_query,
    client_footprint_query,
    invitation_for_update_query,
    relationship_for_update_query,
)


def _sql(statement: object) -> str:
    return str(
        statement.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )


def test_account_lock_query_uses_for_update() -> None:
    sql = _sql(account_for_update_query("client-1"))
    assert "FROM accounts" in sql
    assert "WHERE accounts.id = 'client-1'" in sql
    assert sql.endswith("FOR UPDATE")


def test_invitation_lock_query_uses_for_update() -> None:
    sql = _sql(invitation_for_update_query("inv-1"))
    assert "trainer_client_invitations.id = 'inv-1'" in sql
    assert sql.endswith("FOR UPDATE")


def test_relationship_lock_query_uses_for_update() -> None:
    sql = _sql(relationship_for_update_query("rel-1"))
    assert "trainer_client_relationships.id = 'rel-1'" in sql
    assert sql.endswith("FOR UPDATE")


def test_client_footprint_query_checks_both_p0_tables() -> None:
    sql = _sql(client_footprint_query("client-1"))
    assert "trainer_client_invitations.client_id = 'client-1'" in sql
    assert "trainer_client_relationships.client_id = 'client-1'" in sql
    assert " OR " in sql
