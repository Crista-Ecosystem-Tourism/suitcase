import unittest
from types import SimpleNamespace

from app.mini_site_policy import build_trip_snapshot


class MiniSiteSnapshotTests(unittest.TestCase):
    def setUp(self):
        self.trip = SimpleNamespace(
            city="Санкт-Петербург",
            country="Россия",
            start_date="2026-06-14T10:00:00Z",
            end_date="2026-06-18T10:00:00Z",
            image="https://images.example/cover.jpg?size=large",
            photos=["https://images.example/one.jpg", "file:///private/photo.jpg", "javascript:alert(1)"],
            impressions="  Путешествие запомнилось!  ",
            route_json='[{"latitude":59.94,"longitude":30.31,"name":"Эрмитаж","note":"К открытию"},'
                       '{"latitude":91,"longitude":30,"name":"Invalid"},'
                       '{"latitude":59.95,"longitude":30.32,"name":"Набережная"}]',
        )

    def test_snapshot_is_allow_listed_and_has_safe_derived_stats(self):
        snapshot = build_trip_snapshot(self.trip)
        self.assertEqual(snapshot["title"], "Санкт-Петербург, Россия")
        self.assertEqual(snapshot["summary"], "Путешествие запомнилось!")
        self.assertEqual(snapshot["stats"]["days"], 5)
        self.assertEqual(snapshot["stats"]["places_visited"], 2)
        self.assertGreater(snapshot["stats"]["distance_km"], 0)
        self.assertEqual(snapshot["points"][0]["note"], "К открытию")
        self.assertEqual(snapshot["photos"], ["https://images.example/one.jpg"])
        self.assertEqual(snapshot["cover"], "https://images.example/cover.jpg")
        self.assertNotIn("expenses", snapshot)
        self.assertNotIn("user_id", snapshot)
        self.assertEqual(snapshot["game_stamps"], [])

    def test_snapshot_includes_only_server_verified_game_stamps(self):
        stamp = {
            "key": "red-square", "title": "Explorer", "earned_at": "2026-09-02T10:00:00+00:00",
            "fact": "A sourced fact", "source_label": "History", "source_url": "https://example.test/source",
        }
        snapshot = build_trip_snapshot(self.trip, [stamp])
        self.assertEqual(snapshot["game_stamps"], [stamp])

    def test_malformed_route_and_local_images_do_not_enter_public_snapshot(self):
        self.trip.route_json = "not-json"
        self.trip.photos = ["file:///private/photo.jpg", "http://insecure.example/photo.jpg"]
        self.trip.image = "file:///private/cover.jpg"
        snapshot = build_trip_snapshot(self.trip)
        self.assertEqual(snapshot["points"], [])
        self.assertEqual(snapshot["photos"], [])
        self.assertIsNone(snapshot["cover"])
        self.assertEqual(snapshot["stats"]["places_visited"], 0)


if __name__ == "__main__":
    unittest.main()
