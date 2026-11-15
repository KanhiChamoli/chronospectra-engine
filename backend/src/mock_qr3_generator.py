"""Generate clearly labeled synthetic SPHEREx-like Zarr products for demos.

Run from the repository root with:

    python backend/src/mock_qr3_generator.py

The generator writes its products under ``backend/data/processed/zarr/mock-qr3``
by default. These are deterministic demo data, not NASA observations or
scientifically calibrated SPHEREx measurements. Each product follows the
existing schema-v1 detector-group layout so the regular spectrum and anomaly
endpoints can read it without a separate mock API.
"""

from __future__ import annotations

import argparse
import json
import logging
import math
from pathlib import Path
from typing import Any

import numpy as np
import zarr
from astropy import units as u
from astropy.coordinates import SkyCoord
from astropy.time import Time
from astropy.wcs import WCS

try:
    import healpy as hp
except ImportError:
    hp = None

LOGGER = logging.getLogger("chronospectra.mock_qr3")
HEALPIX_NSIDE = 512
SYNTHETIC_OUTPUT_DIR = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "processed"
    / "zarr"
    / "mock-qr3"
)

# Approximate ICRS target positions are used only to place demo pins on the map.
TARGETS: dict[str, tuple[str, float, float, float]] = {
    "barnards-star": ("Barnard's Star", 269.452075, 4.693391, 3200.0),
    "epsilon-indi-b": ("Epsilon Indi B", 331.04375, -56.7825, 1300.0),
    "wise-0855": ("WISE 0855", 133.7951291667, -7.2451472222, 280.0),
    "rw-aurigae": ("RW Aurigae", 76.9565, 30.4014, 4200.0),
    "r-draconis": ("R Draconis", 240.35, 66.7522, 2800.0),
}

EPOCHS = (
    ("epoch-2025-03", "2025-03-15T00:00:00"),
    ("epoch-2025-09", "2025-09-15T00:00:00"),
)
WAVELENGTH_MIN_UM = 0.75
WAVELENGTH_MAX_UM = 5.0
DETECTORS = ("D1", "D2", "D3", "D4", "D5", "D6")
CO2_FEATURE_UM = 4.27


def _spread_bits(value: int) -> int:
    """Interleave a coordinate's bits into even bit positions."""
    result = 0
    bit = 0
    while value:
        result |= (value & 1) << (2 * bit)
        value >>= 1
        bit += 1
    return result


def _ang2pix_nest_one(ra_deg: float, dec_deg: float, nside: int) -> int:
    """Return one HEALPix NESTED index using the reference ang2pix equations."""
    order = int(math.log2(nside))
    z = math.sin(math.radians(dec_deg))
    za = abs(z)
    tt = (ra_deg % 360.0) / 90.0

    if za <= 2.0 / 3.0:
        temp1 = nside * (0.5 + tt)
        temp2 = nside * z * 0.75
        jp = math.floor(temp1 - temp2)
        jm = math.floor(temp1 + temp2)
        ifp = jp >> order
        ifm = jm >> order
        if ifp == ifm:
            face = (ifp & 3) + 4
        elif ifp < ifm:
            face = ifp & 3
        else:
            face = (ifm & 3) + 8
        ix = jm & (nside - 1)
        iy = nside - (jp & (nside - 1)) - 1
    else:
        ntt = min(3, math.floor(tt))
        tp = tt - ntt
        tmp = nside * math.sqrt(3.0 * (1.0 - za))
        jp = min(nside - 1, math.floor(tp * tmp))
        jm = min(nside - 1, math.floor((1.0 - tp) * tmp))
        if z >= 0.0:
            face = ntt
            ix = nside - jm - 1
            iy = nside - jp - 1
        else:
            face = ntt + 8
            ix = jp
            iy = jm

    in_face = _spread_bits(ix) | (_spread_bits(iy) << 1)
    return face * nside * nside + in_face


def _healpix_indices(ra: np.ndarray, dec: np.ndarray) -> np.ndarray:
    """Compute NESTED indices, using healpy when installed and a small fallback otherwise."""
    if hp is not None:
        return np.asarray(
            hp.ang2pix(HEALPIX_NSIDE, ra, dec, lonlat=True, nest=True),
            dtype=np.int64,
        )
    return np.fromiter(
        (_ang2pix_nest_one(float(lon), float(lat), HEALPIX_NSIDE)
         for lon, lat in zip(ra.flat, dec.flat, strict=True)),
        dtype=np.int64,
        count=ra.size,
    ).reshape(ra.shape)


def _blackbody_shape(wavelength_um: np.ndarray, temperature_k: float) -> np.ndarray:
    """Return a numerically stable, unit-maximum Planck-like continuum."""
    exponent = 14387.76877 / (temperature_k * wavelength_um)
    log_radiance = -5.0 * np.log(wavelength_um) - np.log(np.expm1(exponent))
    log_radiance -= float(np.max(log_radiance))
    return np.exp(np.clip(log_radiance, -40.0, 0.0))


def _absorption(
    wavelength_um: np.ndarray, center_um: float, width_um: float, depth: float
) -> np.ndarray:
    return 1.0 - depth * np.exp(
        -0.5 * ((wavelength_um - center_um) / width_um) ** 2
    )


def _target_spectrum(
    target_id: str, wavelength_um: np.ndarray, temperature_k: float
) -> np.ndarray:
    continuum = _blackbody_shape(wavelength_um, temperature_k)
    if target_id == "barnards-star":
        features = _absorption(wavelength_um, 3.0, 0.11, 0.16)
        features *= _absorption(wavelength_um, 4.27, 0.08, 0.08)
        return 120.0 * continuum * features + 2.0
    if target_id == "epsilon-indi-b":
        features = _absorption(wavelength_um, 1.65, 0.12, 0.42)
        features *= _absorption(wavelength_um, 2.2, 0.16, 0.28)
        features *= _absorption(wavelength_um, 3.3, 0.20, 0.35)
        features *= _absorption(wavelength_um, 4.27, 0.10, 0.15)
        return 90.0 * continuum * features + 0.8
    if target_id == "wise-0855":
        features = _absorption(wavelength_um, 1.4, 0.20, 0.50)
        features *= _absorption(wavelength_um, 1.9, 0.22, 0.45)
        features *= _absorption(wavelength_um, 3.3, 0.24, 0.35)
        return 35.0 * continuum * features + 0.2
    if target_id == "rw-aurigae":
        warm_dust = 0.18 * np.power(wavelength_um / 2.0, 1.1)
        features = _absorption(wavelength_um, 3.0, 0.14, 0.12)
        return 75.0 * (continuum + warm_dust) * features + 1.0
    features = _absorption(wavelength_um, 2.8, 0.18, 0.30)
    features *= _absorption(wavelength_um, 4.27, 0.10, 0.08)
    return 105.0 * continuum * features + 1.5


def _spatial_wcs(center: SkyCoord) -> WCS:
    wcs = WCS(naxis=2)
    wcs.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    wcs.wcs.cunit = ["deg", "deg"]
    wcs.wcs.crval = [center.ra.deg, center.dec.deg]
    wcs.wcs.crpix = [2.0, 2.0]
    wcs.wcs.cdelt = [-1.0 / 3600.0, 1.0 / 3600.0]
    return wcs


def _create_product(
    path: Path,
    *,
    target_id: str,
    target_name: str,
    target_ra_deg: float,
    target_dec_deg: float,
    epoch: str,
    date_obs: str,
    detector: str,
    wavelength_um: float,
    bandwidth_um: float,
    flux_mjy_sr: float,
    variance_mjy_sr2: float,
    flags_value: int,
    channel_index: int,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    center = SkyCoord(ra=target_ra_deg, dec=target_dec_deg, unit="deg", frame="icrs")
    wcs = _spatial_wcs(center)
    rows, columns = np.mgrid[0:3, 0:3]
    ra, dec = wcs.pixel_to_world_values(columns, rows)
    ra = np.asarray(ra, dtype=np.float32)
    dec = np.asarray(dec, dtype=np.float32)
    group = zarr.open_group(str(path), mode="w")
    chunk_shape = (3, 3)

    arrays: dict[str, np.ndarray] = {
        "flux_mjy_sr": np.full(chunk_shape, flux_mjy_sr, dtype=np.float32),
        "variance_mjy_sr2": np.full(
            chunk_shape, variance_mjy_sr2, dtype=np.float32
        ),
        "flags": np.full(chunk_shape, flags_value, dtype=np.uint32),
        "ra_deg": ra,
        "dec_deg": dec,
        "wavelength_um": np.full(chunk_shape, wavelength_um, dtype=np.float32),
        "bandwidth_um": np.full(chunk_shape, bandwidth_um, dtype=np.float32),
        "healpix_nest": _healpix_indices(ra, dec),
    }
    for array_name, values in arrays.items():
        group.create_dataset(
            array_name,
            data=values,
            shape=values.shape,
            chunks=chunk_shape,
            dtype=values.dtype,
            overwrite=True,
        )

    group.attrs.update(
        {
            "target_id": target_id,
            "target_name": target_name,
            "target_ra_deg": target_ra_deg,
            "target_dec_deg": target_dec_deg,
            "schema_version": 1,
            "source_file": f"synthetic-{target_id}-{epoch}-{channel_index:03d}.fits",
            "date_obs": date_obs,
            "mjd": float(Time(date_obs).mjd),
            "epoch": epoch,
            "epoch_start_mjd": float(Time(f"{epoch[6:]}-01T00:00:00").mjd),
            "detector": detector,
            "flux_unit": "MJy/sr",
            "healpix_nside": HEALPIX_NSIDE,
            "healpix_ordering": "NESTED",
            "healpix_index_available": True,
            "spatial_wcs_header": wcs.to_header().tostring(
                sep="\n", endcard=False, padding=False
            ),
            "spectral_wcs_is_visualization_grade": True,
            "synthetic": True,
            "synthetic_source": "Chronospectra demo generator; not NASA data",
            "synthetic_contamination_flag": flags_value,
            "complete": True,
        }
    )


def generate_synthetic_products(
    output_root: Path,
    *,
    target_ids: list[str] | None = None,
    band_count: int = 102,
) -> dict[str, Any]:
    """Create one schema-compatible Zarr product per target, epoch, and channel."""
    if band_count < 2:
        raise ValueError("band_count must be at least 2")
    selected_targets = target_ids or list(TARGETS)
    unknown_targets = sorted(set(selected_targets) - TARGETS.keys())
    if unknown_targets:
        raise ValueError(f"Unknown target id(s): {', '.join(unknown_targets)}")

    wavelengths = np.linspace(
        WAVELENGTH_MIN_UM, WAVELENGTH_MAX_UM, band_count, dtype=np.float64
    )
    bandwidth_um = float((WAVELENGTH_MAX_UM - WAVELENGTH_MIN_UM) / (band_count - 1))
    rng = np.random.default_rng(20261115)
    product_count = 0

    for target_id in selected_targets:
        target_name, base_ra, base_dec, temperature_k = TARGETS[target_id]
        base_spectrum = _target_spectrum(target_id, wavelengths, temperature_k)
        for epoch_index, (epoch, date_obs) in enumerate(EPOCHS):
            # Small sub-pixel shifts make the synthetic epoch positions visibly distinct.
            shift_arcsec = (
                (-0.5 if epoch_index == 0 else 0.5)
                if target_id in {"epsilon-indi-b", "wise-0855"}
                else 0.0
            )
            shifted_coord = SkyCoord(
                ra=base_ra,
                dec=base_dec,
                unit="deg",
                frame="icrs",
            ).directional_offset_by(
                90.0 * (epoch_index % 2),
                abs(shift_arcsec) * u.arcsec,
            )
            target_ra = float(shifted_coord.ra.deg)
            target_dec = float(shifted_coord.dec.deg)

            for channel_index, wavelength_um in enumerate(wavelengths):
                flux = float(base_spectrum[channel_index])
                if epoch_index == 1 and target_id in {"epsilon-indi-b", "wise-0855"}:
                    feature_weight = math.exp(
                        -0.5 * ((float(wavelength_um) - CO2_FEATURE_UM) / 0.055) ** 2
                    )
                    change = 0.32 if target_id == "epsilon-indi-b" else -0.30
                    flux *= 1.0 + change * feature_weight
                flux *= 1.0 + float(rng.normal(0.0, 0.002))
                variance = max((0.03 * flux) ** 2, 1e-8)
                contamination_flag = 1 if channel_index % 23 == 0 else 0
                detector = DETECTORS[channel_index % len(DETECTORS)]
                product_path = (
                    output_root
                    / target_id
                    / epoch
                    / f"channel-{channel_index:03d}-{detector}.zarr"
                )
                _create_product(
                    product_path,
                    target_id=target_id,
                    target_name=target_name,
                    target_ra_deg=target_ra,
                    target_dec_deg=target_dec,
                    epoch=epoch,
                    date_obs=date_obs,
                    detector=detector,
                    wavelength_um=float(wavelength_um),
                    bandwidth_um=bandwidth_um,
                    flux_mjy_sr=flux,
                    variance_mjy_sr2=variance,
                    flags_value=contamination_flag,
                    channel_index=channel_index,
                )
                product_count += 1

    return {
        "output_root": str(output_root.resolve()),
        "product_count": product_count,
        "target_count": len(selected_targets),
        "band_count": band_count,
        "epochs": [epoch for epoch, _ in EPOCHS],
        "synthetic": True,
        "notice": "Demo-only values; not NASA SPHEREx observations.",
    }


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=SYNTHETIC_OUTPUT_DIR,
        help="Separate synthetic Zarr output (default: backend/data/processed/zarr/mock-qr3).",
    )
    parser.add_argument(
        "--target",
        action="append",
        choices=sorted(TARGETS),
        help="Target id to generate; repeat to select multiple (default: all five).",
    )
    return parser.parse_args()


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    args = _parse_args()
    result = generate_synthetic_products(args.output_dir.resolve(), target_ids=args.target)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
