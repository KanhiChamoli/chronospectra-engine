"""Download SPHEREx QR3 cutouts from IRSA and store them as chunked Zarr.

The official challenge test targets are queried through IRSA's SIA2 service.
Each returned spectral-image MEF is saved under ``backend/data/raw`` and
converted to a per-observation Zarr group under ``backend/data/processed/zarr``.
The Zarr groups retain detector-level measurements, variance, flags, spatial
coordinates, the per-pixel wavelength/bandwidth WCS, and nested HEALPix indices.
Keeping the native samples avoids inventing band centers or co-adding detector
arrays that do not sample the same wavelength.

IRSA currently publishes an official 102-channel DR1 HiPS all-sky cube for
WWT. It is a display layer, not a QR3 product and not a substitute for the
science values in the QR3 Zarr groups. A local manifest pointing to that
published HiPS tree is written under ``backend/data/processed/hips``.

Run from the backend directory after installing ``requirements.txt``:

    python -m pip install -r requirements.txt
    python src/ingest_spherex.py

Optional R2 upload:

    $env:R2_ACCOUNT_ID = "..."
    $env:R2_ACCESS_KEY_ID = "..."
    $env:R2_SECRET_ACCESS_KEY = "..."
    $env:R2_BUCKET = "chronospectra"
    python src/ingest_spherex.py --upload-r2

The SIA query and cutout service are public; no IRSA credentials are embedded
or required. Name resolution for all targets except WISE 0855 uses Astropy's
name resolver and therefore requires network access.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import math
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import numpy as np
import requests
import zarr
from astropy import units as u
from astropy.coordinates import SkyCoord
from astropy.io import fits
from astropy.time import Time
from astropy.wcs import WCS
from astroquery.ipac.irsa import Irsa
from botocore.config import Config
from boto3 import client as boto3_client
from pyvo.dal.exceptions import DALServiceError

try:
    import healpy as hp
except ImportError:
    hp = None

LOGGER = logging.getLogger("chronospectra.ingest")

IRSA_SIA2_URL = "https://irsa.ipac.caltech.edu/SIA"
QR3_COLLECTION = "spherex_qr3"
OFFICIAL_HIPS_URL = (
    "https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube"
)
HEALPIX_NSIDE = 512
ROW_CHUNK_SIZE = 128
REMOTE_TIMEOUT_SECONDS = 180
SIA_QUERY_MAX_ATTEMPTS = 4
SIA_QUERY_RETRY_DELAY_SECONDS = 1
DOWNLOAD_MAX_ATTEMPTS = 4
DOWNLOAD_RETRY_DELAY_SECONDS = 1

TARGETS: dict[str, tuple[str, SkyCoord | None]] = {
    "barnards-star": ("Barnard's Star", None),
    "epsilon-indi-b": ("Epsilon Indi B", None),
    "wise-0855": (
        "WISE 0855",
        SkyCoord(
            ra="08h55m10.831s",
            dec="-7d14m42.53s",
            frame="icrs",
        ),
    ),
    "rw-aurigae": ("RW Aurigae", None),
    "r-draconis": ("R Draconis", None),
}

BACKEND_DIR = Path(__file__).resolve().parents[1]


def _safe_name(value: str) -> str:
    """Convert a target or URL component to a safe, stable path component."""
    slug = re.sub(r"[^a-zA-Z0-9._-]+", "-", value).strip("-._")
    return slug or "spherex-product"


def _resolve_target(target_id: str) -> tuple[str, SkyCoord]:
    name, known_coordinate = TARGETS[target_id]
    if known_coordinate is not None:
        return name, known_coordinate
    coordinate = SkyCoord.from_name(name)
    if not np.isfinite(coordinate.ra.deg) or not np.isfinite(coordinate.dec.deg):
        raise ValueError(f"Name resolver returned invalid coordinates for {name!r}")
    return name, coordinate.icrs


def _cutout_url(access_url: str, coord: SkyCoord, size_arcsec: float) -> str:
    """Append IRSA's documented center/size cutout parameters to an access URL."""
    parts = urlsplit(access_url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query["center"] = f"{coord.ra.deg:.8f},{coord.dec.deg:.8f}d"
    query["size"] = f"{size_arcsec / 3600.0:.8f}"
    return urlunsplit(
        (parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment)
    )


def _download(url: str, destination: Path) -> None:
    """Stream a FITS product to disk and remove partial downloads on failure."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".part")
    for attempt in range(1, DOWNLOAD_MAX_ATTEMPTS + 1):
        try:
            with requests.get(url, stream=True, timeout=REMOTE_TIMEOUT_SECONDS) as response:
                response.raise_for_status()
                with temporary.open("wb") as output:
                    for block in response.iter_content(chunk_size=1024 * 1024):
                        if block:
                            output.write(block)
            temporary.replace(destination)
            return
        except requests.RequestException as error:
            temporary.unlink(missing_ok=True)
            status_code = (
                error.response.status_code
                if isinstance(error, requests.HTTPError) and error.response is not None
                else None
            )
            retryable = status_code is None or status_code == 429 or status_code >= 500
            if not retryable or attempt == DOWNLOAD_MAX_ATTEMPTS:
                raise
            delay = DOWNLOAD_RETRY_DELAY_SECONDS * 2 ** (attempt - 1)
            LOGGER.warning(
                "FITS download failed (attempt %d/%d): %s; retrying in %d seconds",
                attempt,
                DOWNLOAD_MAX_ATTEMPTS,
                error,
                delay,
            )
            time.sleep(delay)
        except OSError:
            temporary.unlink(missing_ok=True)
            raise
    raise RuntimeError(f"FITS download ended without a result: {destination}")


def _quantity_in_microns(value: Any) -> np.ndarray:
    """Return an Astropy WCS value in microns without assuming its input unit."""
    if hasattr(value, "to_value"):
        return np.asarray(value.to_value(u.um), dtype=np.float32)
    return np.asarray(value, dtype=np.float32)


def _epoch_for(date_obs: str) -> tuple[str, float]:
    """Return a six-calendar-month epoch label and its starting MJD."""
    observed = Time(date_obs)
    observed_datetime = observed.to_datetime(timezone=timezone.utc)
    months_since_start = (
        (observed_datetime.year - 2025) * 12 + observed_datetime.month - 3
    )
    epoch_index = math.floor(months_since_start / 6)
    start_month_index = 2 + epoch_index * 6
    start_year = 2025 + start_month_index // 12
    start_month = start_month_index % 12 + 1
    epoch_start = datetime(start_year, start_month, 1, tzinfo=timezone.utc)
    start_mjd = Time(epoch_start).mjd
    return f"epoch-{start_year}-{start_month:02d}", float(start_mjd)


def process_mef_to_zarr(
    fits_path: Path,
    zarr_path: Path,
    *,
    target_id: str,
    target_name: str,
    target_coord: SkyCoord,
    archive_collection: str = QR3_COLLECTION,
    product_id: str | None = None,
    access_url: str | None = None,
    cutout_url: str | None = None,
    force: bool = False,
) -> dict[str, object]:
    """Convert one SPHEREx spectral-image MEF into a chunked, WCS-aware Zarr group.

    Image pixels remain in their native calibrated MJy/sr values. The spatial,
    spectral, and HEALPix index arrays are generated in row blocks so full
    detector images do not require several extra full-image arrays in memory.
    """
    if zarr_path.exists() and not force:
        try:
            existing_group = zarr.open_group(str(zarr_path), mode="r")
        except (zarr.errors.GroupNotFoundError, zarr.errors.PathNotFoundError):
            LOGGER.warning("Existing Zarr store is incomplete and will be regenerated")
        else:
            has_current_provenance = (
                existing_group.attrs.get("archive_collection") == archive_collection
                and existing_group.attrs.get("archive_product_id") == (product_id or "")
                and existing_group.attrs.get("archive_access_url") == (access_url or "")
                and existing_group.attrs.get("download_url") == (cutout_url or "")
            )
            if existing_group.attrs.get("complete") is True and has_current_provenance:
                LOGGER.info("Zarr product already exists; skipping: %s", zarr_path)
                return {
                    "zarr_path": str(zarr_path),
                    "status": "skipped-existing",
                    "release": _release_name(archive_collection),
                    "archive_collection": archive_collection,
                    "product_id": product_id,
                    "access_url": access_url,
                    "cutout_url": cutout_url,
                }
            LOGGER.warning(
                "Existing Zarr group is incomplete or has stale provenance; regenerating"
            )

    # FITS integer flags commonly use BZERO/BSCALE, which Astropy cannot
    # expose through a memory-mapped array.
    with fits.open(fits_path, memmap=False, lazy_load_hdus=True) as hdul:
        try:
            image_hdu = hdul["IMAGE"]
            variance_hdu = hdul["VARIANCE"]
            flags_hdu = hdul["FLAGS"]
        except (KeyError, IndexError) as exc:
            raise ValueError(
                f"{fits_path} is missing one of IMAGE, VARIANCE, or FLAGS"
            ) from exc

        image = image_hdu.data
        variance = variance_hdu.data
        flags = flags_hdu.data
        if image is None or image.ndim != 2:
            raise ValueError(f"{fits_path} IMAGE extension must be a 2-D image")
        if variance is None or variance.shape != image.shape:
            raise ValueError(f"{fits_path} VARIANCE shape does not match IMAGE")
        if flags is None or flags.shape != image.shape:
            raise ValueError(f"{fits_path} FLAGS shape does not match IMAGE")

        image_header = image_hdu.header
        primary_header = hdul[0].header
        date_obs = image_header.get("DATE-OBS") or primary_header.get("DATE-OBS")
        if not date_obs:
            raise ValueError(f"{fits_path} is missing DATE-OBS")
        observed = Time(str(date_obs))
        epoch, epoch_start_mjd = _epoch_for(str(date_obs))

        spatial_wcs = WCS(image_header).celestial
        spectral_wcs = WCS(header=image_header, fobj=hdul, key="W")
        spectral_wcs.sip = None

        rows, columns = image.shape
        chunk_shape = (min(256, rows), min(256, columns))
        zarr_path.parent.mkdir(parents=True, exist_ok=True)
        group = zarr.open_group(str(zarr_path), mode="w")
        arrays = {
            "flux_mjy_sr": group.create_dataset(
                "flux_mjy_sr", shape=image.shape, chunks=chunk_shape, dtype="f4"
            ),
            "variance_mjy_sr2": group.create_dataset(
                "variance_mjy_sr2", shape=image.shape, chunks=chunk_shape, dtype="f4"
            ),
            "flags": group.create_dataset(
                "flags", shape=image.shape, chunks=chunk_shape, dtype="u4"
            ),
            "ra_deg": group.create_dataset(
                "ra_deg", shape=image.shape, chunks=chunk_shape, dtype="f4"
            ),
            "dec_deg": group.create_dataset(
                "dec_deg", shape=image.shape, chunks=chunk_shape, dtype="f4"
            ),
            "wavelength_um": group.create_dataset(
                "wavelength_um", shape=image.shape, chunks=chunk_shape, dtype="f4"
            ),
            "bandwidth_um": group.create_dataset(
                "bandwidth_um", shape=image.shape, chunks=chunk_shape, dtype="f4"
            ),
            "healpix_nest": group.create_dataset(
                "healpix_nest", shape=image.shape, chunks=chunk_shape, dtype="i8"
            ),
        }

        x_values = np.arange(columns, dtype=np.float64)
        for row_start in range(0, rows, ROW_CHUNK_SIZE):
            row_end = min(row_start + ROW_CHUNK_SIZE, rows)
            y_values = np.arange(row_start, row_end, dtype=np.float64)
            x_grid, y_grid = np.meshgrid(x_values, y_values)

            ra, dec = spatial_wcs.pixel_to_world_values(x_grid, y_grid)
            wavelength, bandwidth = spectral_wcs.pixel_to_world(x_grid, y_grid)
            ra = np.asarray(ra, dtype=np.float32)
            dec = np.asarray(dec, dtype=np.float32)
            wavelength_um = _quantity_in_microns(wavelength)
            bandwidth_um = _quantity_in_microns(bandwidth)
            valid_coordinates = (
                np.isfinite(ra)
                & np.isfinite(dec)
                & (dec >= -90.0)
                & (dec <= 90.0)
            )
            healpix_index = np.full(ra.shape, -1, dtype=np.int64)
            if hp is not None:
                healpix_index[valid_coordinates] = hp.ang2pix(
                    HEALPIX_NSIDE,
                    ra[valid_coordinates],
                    dec[valid_coordinates],
                    lonlat=True,
                    nest=True,
                )

            row_slice = slice(row_start, row_end)
            arrays["flux_mjy_sr"][row_slice, :] = np.asarray(
                image[row_slice, :], dtype=np.float32
            )
            arrays["variance_mjy_sr2"][row_slice, :] = np.asarray(
                variance[row_slice, :], dtype=np.float32
            )
            arrays["flags"][row_slice, :] = np.asarray(flags[row_slice, :], dtype=np.uint32)
            arrays["ra_deg"][row_slice, :] = ra
            arrays["dec_deg"][row_slice, :] = dec
            arrays["wavelength_um"][row_slice, :] = wavelength_um
            arrays["bandwidth_um"][row_slice, :] = bandwidth_um
            arrays["healpix_nest"][row_slice, :] = healpix_index

        detector = str(image_header.get("DETECTOR", "unknown"))
        mjd = float(observed.mjd)
        group.attrs.update(
            {
                "target_id": target_id,
                "schema_version": 1,
                "target_name": target_name,
                "release": _release_name(archive_collection),
                "archive_collection": archive_collection,
                "archive_product_id": product_id or "",
                "archive_access_url": access_url or "",
                "download_url": cutout_url or "",
                "target_ra_deg": float(target_coord.ra.deg),
                "target_dec_deg": float(target_coord.dec.deg),
                "source_file": fits_path.name,
                "date_obs": str(date_obs),
                "mjd": mjd,
                "epoch": epoch,
                "epoch_start_mjd": epoch_start_mjd,
                "detector": detector,
                "flux_unit": str(image_header.get("BUNIT", "MJy/sr")),
                "flux_extension": "IMAGE",
                "variance_extension": "VARIANCE",
                "flags_extension": "FLAGS",
                "healpix_nside": HEALPIX_NSIDE,
                "healpix_ordering": "NESTED",
                "healpix_index_available": hp is not None,
                "spatial_wcs_header": image_header.tostring(
                    sep="\n", endcard=False, padding=False
                ),
                "spectral_wcs_is_visualization_grade": True,
                "complete": True,
            }
        )

    return {
        "zarr_path": str(zarr_path),
        "status": "created",
        "release": _release_name(archive_collection),
        "archive_collection": archive_collection,
        "product_id": product_id,
        "epoch": epoch,
        "detector": detector,
    }


def _query_target(
    target_coord: SkyCoord,
    *,
    collection: str,
    radius_arcsec: float,
) -> Any:
    """Query IRSA SIA2 for spectral-image products overlapping one target."""
    Irsa.sia_url = IRSA_SIA2_URL
    for attempt in range(1, SIA_QUERY_MAX_ATTEMPTS + 1):
        try:
            return Irsa.query_sia(
                pos=(target_coord, radius_arcsec * u.arcsec),
                collection=[collection],
            )
        except (DALServiceError, requests.RequestException) as error:
            if attempt == SIA_QUERY_MAX_ATTEMPTS:
                raise
            delay = SIA_QUERY_RETRY_DELAY_SECONDS * 2 ** (attempt - 1)
            LOGGER.warning(
                "IRSA SIA2 query failed for RA=%.6f Dec=%.6f "
                "(attempt %d/%d): %s; retrying in %d seconds",
                target_coord.ra.deg,
                target_coord.dec.deg,
                attempt,
                SIA_QUERY_MAX_ATTEMPTS,
                error,
                delay,
            )
            time.sleep(delay)
    raise RuntimeError("IRSA SIA2 query ended without a response")


def _select_quicklook_products(results: Any) -> Any:
    """Keep the latest product per detector and six-month epoch for a small sample."""
    required_columns = {"t_min", "obs_publisher_did"}
    missing_columns = required_columns.difference(results.colnames)
    if missing_columns:
        raise ValueError(
            "IRSA SIA2 response is missing quicklook columns: "
            + ", ".join(sorted(missing_columns))
        )

    latest_by_detector: dict[tuple[str, str], tuple[float, int]] = {}
    for index, row in enumerate(results):
        if np.ma.is_masked(row["t_min"]):
            continue
        mjd = float(row["t_min"])
        if not math.isfinite(mjd):
            continue
        product_id = _product_identifier(row, results.colnames)
        if product_id is None:
            continue
        detector_match = re.search(r"/D(\d+)$", product_id)
        if detector_match is None:
            continue

        epoch, _ = _epoch_for(Time(mjd, format="mjd").isot)
        key = (epoch, detector_match.group(1))
        previous = latest_by_detector.get(key)
        if previous is None or mjd > previous[0]:
            latest_by_detector[key] = (mjd, index)

    if len(results) > 0 and not latest_by_detector:
        raise ValueError(
            "IRSA SIA2 rows had no usable detector IDs and observation times "
            "for quicklook selection"
        )

    selected = sorted(latest_by_detector.values())
    return results[[index for _, index in selected]]


def _release_name(collection: str) -> str:
    """Name only the configured QR3 collection; do not infer other releases."""
    return "QR3" if collection.casefold() == QR3_COLLECTION.casefold() else "unverified"


def _product_identifier(row: Any, column_names: list[str]) -> str | None:
    """Return an archive-supplied identifier without inventing one from a URL."""
    for column in ("obs_publisher_did", "obs_id", "product_id", "id"):
        if column not in column_names:
            continue
        value = row[column]
        if value is None or np.ma.is_masked(value):
            continue
        if isinstance(value, np.generic):
            value = value.item()
        identifier = str(value).strip()
        if identifier:
            return identifier
    return None


def _download_target_products(
    results: Any,
    *,
    target_id: str,
    target_coord: SkyCoord,
    raw_dir: Path,
    cutout_size_arcsec: float,
) -> list[tuple[str, str, Path, str | None]]:
    if "access_url" not in results.colnames:
        raise ValueError("IRSA SIA2 response has no access_url column")

    target_dir = raw_dir / target_id
    target_dir.mkdir(parents=True, exist_ok=True)
    downloads: list[tuple[str, str, Path, str | None]] = []
    seen_urls: set[str] = set()

    for row in results:
        raw_url = row["access_url"]
        if np.ma.is_masked(raw_url):
            LOGGER.warning("Skipping SIA2 row with an empty access_url")
            continue
        access_url = str(raw_url)
        if not access_url.startswith(("https://", "http://")):
            raise ValueError(f"IRSA returned a non-HTTP access URL: {access_url!r}")
        cutout = _cutout_url(access_url, target_coord, cutout_size_arcsec)
        if cutout in seen_urls:
            continue
        seen_urls.add(cutout)

        digest = hashlib.sha256(cutout.encode("utf-8")).hexdigest()[:16]
        filename = f"{_safe_name(target_id)}-{digest}.fits"
        destination = target_dir / filename
        if not destination.exists():
            LOGGER.info("Downloading %s", destination)
            _download(cutout, destination)
        downloads.append(
            (
                access_url,
                cutout,
                destination,
                _product_identifier(row, results.colnames),
            )
        )
    return downloads


def _write_hips_manifest(hips_dir: Path) -> Path:
    """Record the official DR1 WWT layer without copying the all-sky tile tree."""
    hips_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = hips_dir / "irsa-spherex-dr1.json"
    manifest = {
        "title": "SPHEREx DR1 All-Sky Cube",
        "release": "DR1",
        "hips_url": OFFICIAL_HIPS_URL,
        "properties_url": f"{OFFICIAL_HIPS_URL}/properties",
        "spectral_channels": 102,
        "display_only": True,
        "note": (
            "This is the official IRSA DR1 HiPS layer. It is separate from the "
            "QR3 MEFs ingested into Zarr and is intended for WWT visualization."
        ),
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest_path


def _upload_to_r2(source_dir: Path, prefix: str) -> None:
    """Upload generated files to an S3-compatible Cloudflare R2 bucket."""
    account_id = os.environ.get("R2_ACCOUNT_ID")
    access_key = os.environ.get("R2_ACCESS_KEY_ID")
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY")
    bucket = os.environ.get("R2_BUCKET")
    if not all((account_id, access_key, secret_key, bucket)):
        raise RuntimeError(
            "R2 upload requested but R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, "
            "R2_SECRET_ACCESS_KEY, and R2_BUCKET are not all set"
        )

    client = boto3_client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
        config=Config(s3={"addressing_style": "path"}),
    )
    normalized_prefix = prefix.strip("/")
    for path in source_dir.rglob("*"):
        if not path.is_file():
            continue
        key = "/".join(
            part
            for part in (normalized_prefix, path.relative_to(source_dir).as_posix())
            if part
        )
        LOGGER.info("Uploading %s to R2 key %s", path, key)
        client.upload_file(str(path), bucket, key)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--target",
        action="append",
        choices=sorted(TARGETS),
        help="Target slug; repeat to select multiple. Defaults to all five challenge targets.",
    )
    parser.add_argument(
        "--collection",
        default=QR3_COLLECTION,
        help="IRSA SIA2 collection to query (default: spherex_qr3).",
    )
    parser.add_argument(
        "--radius-arcsec",
        type=float,
        default=60.0,
        help="SIA2 search radius in arcseconds (default: 60).",
    )
    parser.add_argument(
        "--cutout-size-arcsec",
        type=float,
        default=300.0,
        help="Square cutout size requested from IRSA, in arcseconds (default: 300).",
    )
    parser.add_argument(
        "--raw-dir",
        type=Path,
        default=BACKEND_DIR / "data" / "raw",
        help="Raw FITS destination (default: backend/data/raw).",
    )
    parser.add_argument(
        "--processed-dir",
        type=Path,
        default=BACKEND_DIR / "data" / "processed",
        help="Processed data root (default: backend/data/processed).",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate Zarr groups even when their destination already exists.",
    )
    parser.add_argument(
        "--quicklook",
        action="store_true",
        help=(
            "Ingest the latest available product per detector and six-month epoch; "
            "this is a small, explicitly incomplete sample."
        ),
    )
    parser.add_argument("--upload-r2", action="store_true", help="Upload outputs to R2.")
    parser.add_argument(
        "--r2-prefix",
        default="chronospectra",
        help="Object-key prefix for R2 uploads (default: chronospectra).",
    )
    args = parser.parse_args()
    if args.radius_arcsec <= 0 or args.cutout_size_arcsec <= 0:
        parser.error("--radius-arcsec and --cutout-size-arcsec must be positive")
    return args


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    args = _parse_args()
    if hp is None:
        LOGGER.warning(
            "healpy is unavailable; ingest will store -1 HEALPix indices. "
            "Install the backend requirements to populate the optional spatial index."
        )
    target_ids = args.target or list(TARGETS)
    raw_dir = args.raw_dir.resolve()
    processed_dir = args.processed_dir.resolve()
    zarr_root = processed_dir / "zarr"
    hips_manifest = _write_hips_manifest(processed_dir / "hips")
    manifest_path = processed_dir / "ingest-manifest.json"
    target_entries: list[dict[str, object]] = []
    query_errors: list[str] = []
    manifest: dict[str, object] = {
        "service": IRSA_SIA2_URL,
        "release": _release_name(args.collection),
        "collection": args.collection,
        "selection_mode": (
            "latest-per-detector-per-epoch" if args.quicklook else "all-matching-products"
        ),
        "complete_dataset": False,
        "hips_manifest": str(hips_manifest),
        "targets": target_entries,
    }

    for target_id in target_ids:
        target_name, coordinate = _resolve_target(target_id)
        LOGGER.info(
            "Querying %s at RA=%.8f Dec=%.8f deg",
            target_name,
            coordinate.ra.deg,
            coordinate.dec.deg,
        )
        try:
            results = _query_target(
                coordinate,
                collection=args.collection,
                radius_arcsec=args.radius_arcsec,
            )
        except (DALServiceError, requests.RequestException) as error:
            LOGGER.error("IRSA query failed for %s after retries: %s", target_name, error)
            target_entries.append(
                {
                    "target_id": target_id,
                    "target_name": target_name,
                    "ra_deg": float(coordinate.ra.deg),
                    "dec_deg": float(coordinate.dec.deg),
                    "query_rows": 0,
                    "products": [],
                    "query_error": f"{type(error).__name__}: {error}",
                }
            )
            query_errors.append(target_id)
            continue
        download_rows = (
            _select_quicklook_products(results) if args.quicklook else results
        )
        downloads = _download_target_products(
            download_rows,
            target_id=target_id,
            target_coord=coordinate,
            raw_dir=raw_dir,
            cutout_size_arcsec=args.cutout_size_arcsec,
        )

        target_result: dict[str, object] = {
            "target_id": target_id,
            "target_name": target_name,
            "ra_deg": float(coordinate.ra.deg),
            "dec_deg": float(coordinate.dec.deg),
            "query_rows": len(results),
            "selected_rows": len(download_rows),
            "products": [],
        }
        products: list[dict[str, object]] = []
        for access_url, cutout_url, fits_path, product_id in downloads:
            zarr_path = zarr_root / target_id / f"{fits_path.stem}.zarr"
            product_result = process_mef_to_zarr(
                fits_path,
                zarr_path,
                target_id=target_id,
                target_name=target_name,
                target_coord=coordinate,
                archive_collection=args.collection,
                product_id=product_id,
                access_url=access_url,
                cutout_url=cutout_url,
                force=args.force,
            )
            product_result["fits_path"] = str(fits_path)
            product_result["access_url"] = access_url
            product_result["cutout_url"] = cutout_url
            product_result["product_id"] = product_id
            product_result["release"] = _release_name(args.collection)
            products.append(product_result)
        target_result["products"] = products
        target_entries.append(target_result)

    processed_dir.mkdir(parents=True, exist_ok=True)
    manifest["complete_dataset"] = not args.quicklook and not query_errors
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    LOGGER.info("Wrote ingestion manifest: %s", manifest_path)
    if args.upload_r2:
        _upload_to_r2(processed_dir, args.r2_prefix)
    if query_errors:
        raise RuntimeError(
            "IRSA queries failed after retries for: " + ", ".join(query_errors)
        )


if __name__ == "__main__":
    main()
