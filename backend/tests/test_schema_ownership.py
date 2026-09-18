import unittest
from pathlib import Path

from app.main import app
from app.models import Base


class SchemaOwnershipTests(unittest.TestCase):
    def test_suitcase_metadata_does_not_own_accounts(self):
        self.assertNotIn("app_user", Base.metadata.tables)
        self.assertEqual(
            {"suitcase_trip", "suitcase_expense", "suitcase_goal"},
            set(Base.metadata.tables),
        )

    def test_external_user_foreign_keys_remain_in_the_database_migration(self):
        metadata_targets = {
            foreign_key.target_fullname
            for table in Base.metadata.tables.values()
            for foreign_key in table.foreign_keys
        }
        self.assertNotIn("app_user.id", metadata_targets)

        migration = (
            Path(__file__).parents[1]
            / "alembic"
            / "versions"
            / "0001_create_suitcase_tables.py"
        ).read_text(encoding="utf-8")
        self.assertIn("REFERENCES app_user(id) ON DELETE CASCADE", migration)

    def test_suitcase_api_does_not_publish_a_second_auth_api(self):
        paths = {route.path for route in app.routes}
        self.assertFalse({"/auth/register", "/auth/login", "/auth/me"} & paths)
