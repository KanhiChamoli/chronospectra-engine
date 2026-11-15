import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import requests
from astropy import units as u
from astropy.coordinates import SkyCoord
from astropy.table import Table
from astropy.time import Time
from pyvo.dal.exceptions import DALServiceError

from backend.src.ingest_spherex import (
    _download_target_products,
    _download,
    _product_identifier,
    _query_target,
    _release_name,
    _select_quicklook_products,
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

    def test_sia_query_retries_transient_archive_errors(self) -> None:
        response = object()
        with (
            patch(
                "backend.src.ingest_spherex.Irsa.query_sia",
                side_effect=[DALServiceError("temporary proxy failure"), response],
            ) as query,
            patch("backend.src.ingest_spherex.time.sleep") as sleep,
        ):
            result = _query_target(
                SkyCoord(ra=10 * u.deg, dec=-20 * u.deg),
                collection="spherex_qr3",
                radius_arcsec=60,
            )

        self.assertIs(result, response)
        self.assertEqual(query.call_count, 2)
        sleep.assert_called_once_with(1)

    def test_fits_download_retries_temporary_server_errors(self) -> None:
        unavailable = MagicMock()
        unavailable.__enter__.return_value = unavailable
        unavailable.raise_for_status.side_effect = requests.HTTPError(
            "503 Service Unavailable",
            response=MagicMock(status_code=503),
        )
        available = MagicMock()
        available.__enter__.return_value = available
        available.iter_content.return_value = [b"FITS"]

        with tempfile.TemporaryDirectory() as temporary, patch(
            "backend.src.ingest_spherex.requests.get",
            side_effect=[unavailable, available],
        ) as get, patch("backend.src.ingest_spherex.time.sleep") as sleep:
            destination = Path(temporary) / "product.fits"
            _download("https://irsa.example/product.fits", destination)

            self.assertEqual(destination.read_bytes(), b"FITS")
            self.assertFalse(destination.with_suffix(".fits.part").exists())

        self.assertEqual(get.call_count, 2)
        sleep.assert_called_once_with(1)

    def test_quicklook_keeps_latest_product_per_detector_and_epoch(self) -> None:
        epoch_a = Time("2026-03-15T00:00:00", scale="utc").mjd
        epoch_b = Time("2026-09-15T00:00:00", scale="utc").mjd
        results = Table(
            {
                "t_min": [epoch_a, epoch_a + 1, epoch_a + 2, epoch_b, epoch_b + 1],
                "obs_publisher_did": [
                    "ivo://irsa/spherex_qr3?visit-1/D1",
                    "ivo://irsa/spherex_qr3?visit-2/D1",
                    "ivo://irsa/spherex_qr3?visit-3/D2",
                    "ivo://irsa/spherex_qr3?visit-4/D1",
                    "ivo://irsa/spherex_qr3?visit-5/D2",
                ],
            }
        )

        selected = _select_quicklook_products(results)

        self.assertEqual(len(selected), 4)
        self.assertEqual(
            list(selected["obs_publisher_did"]),
            [
                "ivo://irsa/spherex_qr3?visit-2/D1",
                "ivo://irsa/spherex_qr3?visit-3/D2",
                "ivo://irsa/spherex_qr3?visit-4/D1",
                "ivo://irsa/spherex_qr3?visit-5/D2",
            ],
        )


if __name__ == "__main__":
    unittest.main()
