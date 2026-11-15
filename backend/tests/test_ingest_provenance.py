import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from astropy import units as u
from astropy.coordinates import SkyCoord

from backend.src.ingest_spherex import (
    _download_target_products,
    _product_identifier,
    _release_name,
)


class FakeSiaResults:
    colnames = ["access_url", "obs_id"]

    def __iter__(self):
        return iter(
            [
                {
                    "access_url": "https://irsa.example/product.fits",
                    "obs_id": "observation-456",
                }
            ]
        )


class IngestionProvenanceTests(unittest.TestCase):
    def test_prefers_archive_publisher_id(self) -> None:
        row = {
            "obs_publisher_did": "ivo://irsa/product/123",
            "obs_id": "observation-456",
        }
        self.assertEqual(
            _product_identifier(row, list(row)),
            "ivo://irsa/product/123",
        )

    def test_uses_next_archive_id_when_publisher_id_is_masked(self) -> None:
        row = {"obs_publisher_did": np.ma.masked, "obs_id": "observation-456"}
        self.assertEqual(_product_identifier(row, list(row)), "observation-456")

    def test_does_not_invent_an_id_or_release(self) -> None:
        self.assertIsNone(
            _product_identifier({"access_url": "https://example.test"}, ["access_url"])
        )
        self.assertEqual(_release_name("spherex_qr3"), "QR3")
        self.assertEqual(_release_name("other_collection"), "unverified")

    def test_download_metadata_keeps_archive_and_cutout_urls_distinct(self) -> None:
        with tempfile.TemporaryDirectory() as temporary, patch(
            "backend.src.ingest_spherex._download"
        ):
            products = _download_target_products(
                FakeSiaResults(),
                target_id="wise-0855",
                target_coord=SkyCoord(ra=10 * u.deg, dec=-20 * u.deg),
                raw_dir=Path(temporary),
                cutout_size_arcsec=300,
            )

        archive_url, cutout_url, _, product_id = products[0]
        self.assertEqual(archive_url, "https://irsa.example/product.fits")
        self.assertIn("center=10.00000000%2C-20.00000000d", cutout_url)
        self.assertEqual(product_id, "observation-456")


if __name__ == "__main__":
    unittest.main()
