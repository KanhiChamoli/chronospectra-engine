import os
import tempfile
import unittest
from pathlib import Path

import numpy as np
import zarr
from astropy.wcs import WCS
from fastapi.testclient import TestClient

from backend.main import app
from backend.src.spectroscopy import (
    NoSpectralDataError,
    _PRODUCT_GROUPS_CACHE,
    _PRODUCT_SCAN_CACHE,
    extract_spectrum,
    find_anomalies,
    get_data_status,
    tell_cosmic_story,
)


def _create_sample_group(
    root: Path,
    *,
    name: str,
    target_id: str,
    epoch: str,
    wavelength: float,
    flux: float,
    variance: float = 0.01,
) -> None:
    group = zarr.open_group(str(root / f"{name}.zarr"), mode="w")
    wcs = WCS(naxis=2)
    wcs.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    wcs.wcs.crval = [10.0, 20.0]
    wcs.wcs.crpix = [2.0, 2.0]
    wcs.wcs.cdelt = [-0.01, 0.01]
    header = wcs.to_header()
    shape = (3, 3)
    flux_values = np.full(shape, flux, dtype=np.float32)
    variance_values = np.full(shape, variance, dtype=np.float32)
    wavelength_values = np.full(shape, wavelength, dtype=np.float32)
    for array_name, values, dtype in (
        ("flux_mjy_sr", flux_values, "f4"),
        ("variance_mjy_sr2", variance_values, "f4"),
        ("wavelength_um", wavelength_values, "f4"),
        ("bandwidth_um", np.full(shape, 0.02, dtype=np.float32), "f4"),
        ("flags", np.zeros(shape, dtype=np.uint32), "u4"),
        ("ra_deg", np.full(shape, 10.0, dtype=np.float32), "f4"),
        ("dec_deg", np.full(shape, 20.0, dtype=np.float32), "f4"),
    ):
        array = group.create_dataset(
            array_name, shape=shape, chunks=shape, dtype=dtype
        )
        array[:] = values
    group.attrs.update(
        {
            "complete": True,
            "target_id": target_id,
            "target_name": "Test Variable",
            "target_ra_deg": 10.0,
            "target_dec_deg": 20.0,
            "epoch": epoch,
            "date_obs": f"{epoch[-7:]}-01T00:00:00",
            "detector": "D1",
            "spatial_wcs_header": header.tostring(
                sep="\n", endcard=False, padding=False
            ),
        }
    )


class SpectroscopyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        _create_sample_group(
            self.root,
            name="a-1",
            target_id="test-variable",
            epoch="epoch-2025-03",
            wavelength=3.0,
            flux=10.0,
        )
        _create_sample_group(
            self.root,
            name="a-2",
            target_id="test-variable",
            epoch="epoch-2025-03",
            wavelength=4.27,
            flux=8.0,
        )
        _create_sample_group(
            self.root,
            name="b-1",
            target_id="test-variable",
            epoch="epoch-2025-09",
            wavelength=3.0,
            flux=10.0,
        )
        _create_sample_group(
            self.root,
            name="b-2",
            target_id="test-variable",
            epoch="epoch-2025-09",
            wavelength=4.27,
            flux=10.0,
        )
        self.previous_root = os.environ.get("CHRONOSPECTRA_ZARR_ROOT")
        os.environ["CHRONOSPECTRA_ZARR_ROOT"] = str(self.root)
        _PRODUCT_GROUPS_CACHE.clear()
        _PRODUCT_SCAN_CACHE.clear()

    def tearDown(self) -> None:
        if self.previous_root is None:
            os.environ.pop("CHRONOSPECTRA_ZARR_ROOT", None)
        else:
            os.environ["CHRONOSPECTRA_ZARR_ROOT"] = self.previous_root
        self.temp.cleanup()

    def test_extracts_samples_by_epoch_from_nearest_pixel(self) -> None:
        result = extract_spectrum(10.0, 20.0)
        self.assertEqual(result["available_sample_count"], 2)
        self.assertEqual(result["product_count"], 4)
        self.assertEqual(len(result["epochs"]["epoch-2025-03"]), 2)
        self.assertAlmostEqual(
            result["epochs"]["epoch-2025-09"][1]["wavelength_um"], 4.27, places=5
        )

    def test_data_status_reports_staged_products(self) -> None:
        result = get_data_status(self.root)
        self.assertTrue(result["ready"])
        self.assertEqual(result["product_count"], 4)
        self.assertEqual(result["target_count"], 1)
        self.assertEqual(len(result["epochs"]), 2)

    def test_anomaly_detects_significant_co2_band_change(self) -> None:
        result = find_anomalies(min_significance=5.0)
        self.assertEqual(result["count"], 1)
        anomaly = result["anomalies"][0]
        self.assertEqual(anomaly["target_id"], "test-variable")
        self.assertAlmostEqual(anomaly["wavelength_um"], 4.27, places=2)
        self.assertGreater(anomaly["significance"], 5.0)
        self.assertIn("not confirmation of sublimation", anomaly["narrative"])

    def test_anomaly_cache_isolated_by_zarr_root(self) -> None:
        changed = find_anomalies(min_significance=5.0, zarr_root=self.root)
        self.assertEqual(changed["count"], 1)

        with tempfile.TemporaryDirectory() as other_directory:
            other_root = Path(other_directory)
            for name, epoch in (
                ("a-1", "epoch-2025-03"),
                ("a-2", "epoch-2025-03"),
                ("b-1", "epoch-2025-09"),
                ("b-2", "epoch-2025-09"),
            ):
                wavelength = 3.0 if name.endswith("1") else 4.27
                _create_sample_group(
                    other_root,
                    name=name,
                    target_id="test-variable",
                    epoch=epoch,
                    wavelength=wavelength,
                    flux=10.0,
                )

            unchanged = find_anomalies(min_significance=5.0, zarr_root=other_root)

        self.assertEqual(unchanged["count"], 0)

    def test_anomaly_scan_logs_and_skips_malformed_complete_group(self) -> None:
        group = zarr.open_group(str(self.root / "malformed.zarr"), mode="w")
        wcs = WCS(naxis=2)
        wcs.wcs.ctype = ["RA---TAN", "DEC--TAN"]
        wcs.wcs.crval = [10.0, 20.0]
        wcs.wcs.crpix = [2.0, 2.0]
        wcs.wcs.cdelt = [-0.01, 0.01]
        group.attrs.update(
            {
                "complete": True,
                "target_id": "test-variable",
                "target_name": "Test Variable",
                "target_ra_deg": 10.0,
                "target_dec_deg": 20.0,
                "epoch": "epoch-2025-12",
                "spatial_wcs_header": wcs.to_header().tostring(
                    sep="\n", endcard=False, padding=False
                ),
            }
        )

        with self.assertLogs("chronospectra.spectroscopy", level="WARNING"):
            result = find_anomalies(min_significance=5.0)
        self.assertEqual(result["count"], 1)

    def test_storyteller_is_careful_about_physical_interpretation(self) -> None:
        narrative = tell_cosmic_story(4.27, 1.0, 7.0)
        self.assertIn("candidate change for follow-up", narrative)
        self.assertIn("not confirmation", narrative)

    def test_no_covering_pixel_raises_explicit_error(self) -> None:
        with self.assertRaises(NoSpectralDataError):
            extract_spectrum(180.0, -20.0)

    def test_fastapi_spectrum_and_anomaly_endpoints(self) -> None:
        client = TestClient(app)
        spectra_response = client.get(
            "/api/v1/spectra", params={"ra_deg": 10.0, "dec_deg": 20.0}
        )
        self.assertEqual(spectra_response.status_code, 200)
        self.assertEqual(spectra_response.json()["flux_unit"], "MJy/sr")
        self.assertEqual(
            client.get("/api/v1/spectra", params={"ra_deg": 10.0, "dec_deg": 91.0})
            .status_code,
            422,
        )
        anomaly_response = client.get("/api/v1/anomalies")
        self.assertEqual(anomaly_response.status_code, 200)
        self.assertEqual(anomaly_response.json()["count"], 1)
        paired_response = client.get(
            "/api/v1/anomalies",
            params={
                "epoch_a": "epoch-2025-03",
                "epoch_b": "epoch-2025-09",
            },
        )
        self.assertEqual(paired_response.status_code, 200)
        self.assertEqual(paired_response.json()["epoch_a"], "epoch-2025-03")
        self.assertEqual(paired_response.json()["epoch_b"], "epoch-2025-09")
        self.assertEqual(paired_response.json()["count"], 1)
        status_response = client.get("/api/v1/data-status")
        self.assertEqual(status_response.status_code, 200)
        self.assertTrue(status_response.json()["ready"])


if __name__ == "__main__":
    unittest.main()
