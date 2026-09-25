import unittest
from pathlib import Path

from app.main import app
from app.models import Base


class SchemaOwnershipTests(unittest.TestCase):
    def test_suitcase_metadata_does_not_own_accounts(self):
        self.assertNotIn("app_user", Base.metadata.tables)
        self.assertEqual(
            {"suitcase_trip", "suitcase_expense", "suitcase_goal", "suitcase_trip_publication"},
            set(Base.metadata.tables),
        )
        self.assertIn("completed_at", Base.metadata.tables["suitcase_trip"].columns)
        publication = Base.metadata.tables["suitcase_trip_publication"]
        self.assertTrue(publication.columns["slug"].nullable)
        self.assertTrue(publication.columns["consented_at"].nullable)

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
        self.assertIn("/suitcase/trips/{trip_id}/mini-site", paths)
        self.assertIn("/suitcase/trips/{trip_id}/complete", paths)
        self.assertIn("/t/{slug}", paths)
        self.assertIn("/public-mini-site/{slug}/html", paths)

    def test_mini_site_migration_cascades_with_trip_and_stores_consent_snapshot(self):
        migration = (
            Path(__file__).parents[1]
            / "alembic"
            / "versions"
            / "0002_trip_mini_site_publications.py"
        ).read_text(encoding="utf-8")
        self.assertIn("REFERENCES suitcase_trip", migration)
        self.assertIn("ondelete=\"CASCADE\"", migration)
        self.assertIn("consent_version", migration)
        self.assertIn("snapshot", migration)
        self.assertIn("revoked_at", migration)

    def test_completion_migration_supports_private_drafts_without_destructive_downgrade(self):
        migration = (
            Path(__file__).parents[1]
            / "alembic"
            / "versions"
            / "0003_trip_completion_drafts.py"
        ).read_text(encoding="utf-8")
        self.assertIn('down_revision: Union[str, Sequence[str], None] = "0002_trip_mini_site"', migration)
        self.assertIn('add_column("suitcase_trip", sa.Column("completed_at"', migration)
        self.assertIn("nullable=True", migration)
        self.assertIn("Cannot downgrade while private trip mini-site drafts exist", migration)
        self.assertNotIn("DELETE FROM", migration)
