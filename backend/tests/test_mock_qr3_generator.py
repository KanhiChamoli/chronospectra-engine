import tempfile
import unittest
from pathlib import Path

import zarr

from backend.src.mock_qr3_generator import TARGETS, generate_synthetic_products
from backend.src.spectroscopy import extract_spectrum, find_anomalies, get_data_status


class MockQr3GeneratorTests(unittest.TestCase):
    def test_synthetic_products_drive_spectrum_and_anomaly_endpoints(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            result = generate_synthetic_products(
                root,
                target_ids=["wise-0855"],
            )
            self.assertEqual(result["product_count"], 204)
            ra_deg = TARGETS["wise-0855"][1]
            dec_deg = TARGETS["wise-0855"][2]

            spectrum = extract_spectrum(ra_deg, dec_deg, zarr_root=root)
            self.assertTrue(spectrum["synthetic"])
            self.assertEqual(spectrum["available_sample_count"], 102)
            self.assertEqual(len(spectrum["epochs"]["epoch-2025-03"]), 102)
            self.assertEqual(len(spectrum["epochs"]["epoch-2025-09"]), 102)
            self.assertTrue(
                all(sample["detector"].startswith("D") for samples in spectrum["epochs"].values() for sample in samples)
            )
            self.assertTrue(
                any(sample["flags"] for samples in spectrum["epochs"].values() for sample in samples)
            )
            sample_group = zarr.open_group(
                str(next(root.rglob(".zgroup")).parent), mode="r"
            )
            self.assertTrue(sample_group.attrs["healpix_index_available"])
            self.assertEqual(
                set(sample_group.array_keys()),
                {
                    "flux_mjy_sr",
                    "variance_mjy_sr2",
                    "flags",
                    "ra_deg",
                    "dec_deg",
                    "wavelength_um",
                    "bandwidth_um",
                    "healpix_nest",
                },
            )
            indices = sample_group["healpix_nest"][:]
            self.assertGreaterEqual(indices.min(), 0)
            self.assertLess(indices.max(), 12 * 512**2)

            anomalies = find_anomalies(zarr_root=root)
            self.assertEqual(anomalies["count"], 1)
            self.assertEqual(anomalies["anomalies"][0]["target_id"], "wise-0855")
            self.assertTrue(anomalies["anomalies"][0]["synthetic"])
            self.assertGreater(abs(anomalies["anomalies"][0]["significance"]), 5.0)

            status = get_data_status(root)
            self.assertTrue(status["ready"])
            self.assertEqual(status["synthetic_product_count"], 204)


if __name__ == "__main__":
    unittest.main()
