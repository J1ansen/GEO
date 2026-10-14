from __future__ import annotations
import unittest
from collect import extract_fields


class ExtractionTests(unittest.TestCase):
    def test_original_evidence_and_overnight_hours(self):
        html = '<h1>Example Restaurant</h1><p>Phone: (929) 555-0100</p><p>Address: 145 Mulberry St, New York, NY 10013</p><p>Mon - Sun: 6 PM - 2 AM</p><a href="/menu/">Menu</a>'
        fields, page, error = extract_fields(html, "https://example.com/", "source-one")
        self.assertIsNone(error)
        self.assertEqual(fields["menuUrl"]["value"], "https://example.com/menu/")
        self.assertTrue(fields["hours.1"]["value"]["intervals"][0]["closesNextDay"])
        self.assertNotIn("priceRange", fields)
        self.assertEqual(fields["address"]["evidenceIds"], ["source-one"])

    def test_multiple_restaurant_entities_cannot_overwrite_one_another(self):
        html = '<script type="application/ld+json">[{"@type":"Restaurant","name":"A"},{"@type":"Restaurant","name":"B"}]</script>'
        fields, _, error = extract_fields(html, "https://example.com/", "source")
        self.assertEqual(fields, {})
        self.assertEqual(error, "multiple_restaurant_entities_require_review")

    def test_missing_markup_does_not_claim_absence(self):
        fields, _, _ = extract_fields("<h1>Access denied</h1>", "https://example.com/", "source")
        self.assertNotIn("address", fields)
        self.assertNotIn("hours.1", fields)


if __name__ == "__main__":
    unittest.main()
