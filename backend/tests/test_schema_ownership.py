import unittest

from app.main import app
from app.models import Base


class SchemaOwnershipTests(unittest.TestCase):
    def test_suitcase_metadata_does_not_own_accounts(self):
        self.assertNotIn("app_user", Base.metadata.tables)
        self.assertEqual(
            {"suitcase_trip", "suitcase_expense", "suitcase_goal"},
            set(Base.metadata.tables),
        )

    def test_suitcase_api_does_not_publish_a_second_auth_api(self):
        paths = {route.path for route in app.routes}
        self.assertFalse({"/auth/register", "/auth/login", "/auth/me"} & paths)

