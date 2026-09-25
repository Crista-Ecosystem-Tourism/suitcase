import unittest

from app.game_stamp_ticket import stamps_from_verified_claims


def attested_claims(**overrides):
    claims = {
        "sub": "owner-1",
        "iss": "crista-ai-agent",
        "aud": "crista-suitcase-mini-site",
        "purpose": "trip-mini-site-stamps",
        "stamps": [{
            "key": "moscow-starter",
            "title": "Стартовый штамп",
            "earned_at": "2026-09-25T12:00:00+00:00",
            "fact": "Проверенный факт.",
            "source_label": "Источник",
            "source_url": "https://example.test/fact?tracking=remove#part",
            "unexpected": "never exported",
        }],
    }
    claims.update(overrides)
    return claims


class GameStampTicketPolicyTests(unittest.TestCase):
    def test_owner_scope_and_public_field_allow_list(self):
        stamps = stamps_from_verified_claims(attested_claims(), "owner-1")
        self.assertEqual(1, len(stamps))
        self.assertEqual("https://example.test/fact", stamps[0]["source_url"])
        self.assertNotIn("unexpected", stamps[0])
        with self.assertRaises(ValueError):
            stamps_from_verified_claims(attested_claims(), "other-user")

    def test_invalid_purpose_and_audience_are_rejected(self):
        for changes in ({"purpose": "account-passport"}, {"aud": ["crista-suitcase-mini-site"]}):
            with self.assertRaises(ValueError):
                stamps_from_verified_claims(attested_claims(**changes), "owner-1")

    def test_invalid_or_duplicated_stamps_are_rejected(self):
        cases = (
            {"stamps": []},
            {"stamps": [{"key": "x", "title": "", "earned_at": "2026-09-25T12:00:00Z"}]},
            {"stamps": [
                {"key": "x", "title": "A", "earned_at": "2026-09-25T12:00:00Z"},
                {"key": "x", "title": "B", "earned_at": "2026-09-25T12:00:00Z"},
            ]},
            {"stamps": [{"key": "x", "title": "A", "earned_at": "2026-09-25T12:00:00"}]},
        )
        for changes in cases:
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                stamps_from_verified_claims(attested_claims(**changes), "owner-1")

    def test_non_https_source_is_rejected(self):
        claims = attested_claims()
        claims["stamps"][0]["source_url"] = "http://example.test/fact"
        with self.assertRaises(ValueError):
            stamps_from_verified_claims(claims, "owner-1")


if __name__ == "__main__":
    unittest.main()
