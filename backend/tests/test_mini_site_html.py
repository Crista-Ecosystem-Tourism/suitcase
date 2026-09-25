import unittest

from app.mini_site_html import render_missing_mini_site_html, render_public_mini_site_html


def public_page(visibility="public"):
    return {
        "visibility": visibility,
        "snapshot": {
            "title": 'Rome <script>alert("x")</script>',
            "city": "Rome",
            "country": "Italy",
            "start_date": "2026-09-20",
            "end_date": "2026-09-25",
            "cover": "https://images.example/cover.jpg?signature=private#fragment",
            "summary": "A city walk & a visit.",
            "photos": ["https://images.example/one.jpg?tracking=strip"],
            "points": [
                {"latitude": 41.9, "longitude": 12.5, "name": "Piazza <b>Navona</b>", "note": "At sunset"},
                {"latitude": 41.91, "longitude": 12.51, "name": "Pantheon"},
            ],
            "game_stamps": [{
                "key": "rome", "title": "Rome explorer", "earned_at": "2026-09-21T10:00:00+00:00",
                "fact": "A sourced fact.", "source_label": "Official source",
                "source_url": "https://history.example/rome?tracking=strip#part",
            }],
            "stats": {"days": 6, "places_visited": 2, "distance_km": 2.3},
        },
    }


class MiniSiteHtmlTests(unittest.TestCase):
    def test_public_html_has_server_rendered_content_and_safe_metadata(self):
        html = render_public_mini_site_html(
            public_page(), canonical_url="https://crista.online/t/" + "a" * 32,
        )
        self.assertIn('<meta property="og:title"', html)
        self.assertIn('<link rel="canonical" href="https://crista.online/t/', html)
        self.assertIn("A city walk &amp; a visit.", html)
        self.assertIn('viewBox="0 0 640 260"', html)
        self.assertIn("Rome explorer", html)
        self.assertIn("2026-09-21T10:00:00+00:00", html)
        self.assertIn('href="https://history.example/rome"', html)
        self.assertNotIn("tracking=strip", html)
        self.assertNotIn("signature=private", html)
        self.assertNotIn("<script>alert", html)
        self.assertIn("&lt;script&gt;", html)
        self.assertNotIn('name="robots" content="noindex', html)

    def test_link_only_html_is_noindex_and_has_no_canonical(self):
        html = render_public_mini_site_html(public_page("link"), canonical_url="https://crista.online/t/" + "b" * 32)
        self.assertIn('<meta name="robots" content="noindex, nofollow">', html)
        self.assertNotIn('<link rel="canonical"', html)
        self.assertNotIn('<meta property="og:url"', html)

    def test_missing_or_revoked_page_is_a_noindex_html_404_body(self):
        html = render_missing_mini_site_html()
        self.assertIn('name="robots" content="noindex,nofollow"', html)
        self.assertIn("Владелец мог отозвать доступ", html)


if __name__ == "__main__":
    unittest.main()
