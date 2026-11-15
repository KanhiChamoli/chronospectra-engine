"""Differentiable MHD regularization and local linear-polarization synthesis.

Magnetic fields use channel-first PyTorch layouts: ``(batch, 3, depth, height,
width)`` for a voxel volume and ``(..., 3)`` for individual ray samples. The
three magnetic components are associated with the three array axes in order.
All tensors stay on their original device; no values are copied through NumPy.
"""

from __future__ import annotations

import math
from typing import TypeAlias

import torch
import torch.nn.functional as F
from torch import Tensor

Spacing: TypeAlias = float | tuple[float, float, float] | Tensor


def _epsilon(value: float | None, dtype: torch.dtype) -> float:
    epsilon = value if value is not None else torch.finfo(dtype).eps
    if not math.isfinite(epsilon) or epsilon <= 0.0:
        raise ValueError("eps must be finite and positive")
    return epsilon


def _validate_vector_tensor(name: str, value: Tensor) -> None:
    if value.ndim < 1 or value.shape[-1] != 3:
        raise ValueError(f"{name} must have shape (..., 3)")
    if not value.is_floating_point():
        raise TypeError(f"{name} must be a floating-point tensor")


def project_magnetic_field_to_screen(
    magnetic_field: Tensor,
    photon_direction: Tensor,
    *,
    screen_basis: Tensor | None = None,
    eps: float | None = None,
) -> tuple[Tensor, Tensor]:
    """Project a local magnetic field onto the ray's two-dimensional screen.

    ``photon_direction`` is a spatial unit direction in a local orthonormal
    observer frame, not the coordinate-space components of a four-momentum.
    ``screen_basis`` may supply a parallel-transported orthonormal screen frame
    with shape ``(..., 2, 3)``. If omitted, a deterministic local frame is
    constructed. Passing a transported frame is necessary for comparing
    polarization angles along a curved ray without introducing basis rotation.

    Returns the field components ``(B_1, B_2)`` along the screen basis. The
    default frame uses a discrete reference-axis switch near its pole; provide
    a transported frame when differentiating through those directions.
    """
    _validate_vector_tensor("magnetic_field", magnetic_field)
    _validate_vector_tensor("photon_direction", photon_direction)
    if magnetic_field.device != photon_direction.device:
        raise ValueError("magnetic_field and photon_direction must share a device")
    if magnetic_field.dtype != photon_direction.dtype:
        raise ValueError("magnetic_field and photon_direction must share a dtype")

    tolerance = _epsilon(eps, magnetic_field.dtype)
    direction_norm = torch.linalg.vector_norm(photon_direction, dim=-1, keepdim=True)
    if torch.any(direction_norm <= tolerance):
        raise ValueError("photon_direction must be non-zero")
    direction = photon_direction / direction_norm

    if screen_basis is None:
        z_axis = torch.zeros_like(direction)
        z_axis[..., 2] = 1.0
        y_axis = torch.zeros_like(direction)
        y_axis[..., 1] = 1.0
        reference = torch.where(
            (direction[..., 2].abs() < 0.9).unsqueeze(-1),
            z_axis,
            y_axis,
        )
        basis_1 = F.normalize(torch.linalg.cross(direction, reference, dim=-1), dim=-1)
        basis_2 = torch.linalg.cross(direction, basis_1, dim=-1)
    else:
        if screen_basis.shape[-2:] != (2, 3):
            raise ValueError("screen_basis must have shape (..., 2, 3)")
        if screen_basis.device != magnetic_field.device:
            raise ValueError("screen_basis and magnetic_field must share a device")
        if screen_basis.dtype != magnetic_field.dtype:
            raise ValueError("screen_basis and magnetic_field must share a dtype")
        basis_1 = F.normalize(screen_basis[..., 0, :], dim=-1)
        basis_2 = F.normalize(screen_basis[..., 1, :], dim=-1)

    projected_1 = torch.sum(magnetic_field * basis_1, dim=-1)
    projected_2 = torch.sum(magnetic_field * basis_2, dim=-1)
    return projected_1, projected_2


def stokes_qu_from_magnetic_field(
    emissivity_i: Tensor,
    magnetic_field: Tensor,
    photon_direction: Tensor,
    *,
    polarization_fraction: float | Tensor = 0.75,
    screen_basis: Tensor | None = None,
    eps: float | None = None,
) -> tuple[Tensor, Tensor]:
    """Synthesize local synchrotron Stokes ``Q`` and ``U`` from Stokes ``I``.

    The electric-vector position angle is taken perpendicular to the projected
    magnetic field, as for optically thin synchrotron emission. For projected
    components ``(B_1, B_2)`` in the screen frame, this convention gives
    ``Q = p I (B_2² - B_1²)/(B_1² + B_2²)`` and
    ``U = -2 p I B_1 B_2/(B_1² + B_2²)``. A field parallel to the ray produces
    zero linear polarization. This is a local emissivity mapping, not a full
    polarized radiative-transfer solver: transport the screen basis along the
    geodesic and integrate Q/U with the same transfer/optical-depth scheme as I.
    """
    _validate_vector_tensor("magnetic_field", magnetic_field)
    _validate_vector_tensor("photon_direction", photon_direction)
    if not emissivity_i.is_floating_point():
        raise TypeError("emissivity_i must be a floating-point tensor")
    if (
        emissivity_i.device != magnetic_field.device
        or emissivity_i.dtype != magnetic_field.dtype
    ):
        raise ValueError("emissivity_i and magnetic_field must share dtype and device")

    fraction = torch.as_tensor(
        polarization_fraction,
        dtype=emissivity_i.dtype,
        device=emissivity_i.device,
    )
    if torch.any(~torch.isfinite(fraction)) or torch.any(
        (fraction < 0.0) | (fraction > 1.0)
    ):
        raise ValueError("polarization_fraction must be finite and in [0, 1]")

    b_1, b_2 = project_magnetic_field_to_screen(
        magnetic_field,
        photon_direction,
        screen_basis=screen_basis,
        eps=eps,
    )
    regularizer = _epsilon(eps, emissivity_i.dtype)
    denominator = b_1.square() + b_2.square() + regularizer
    polarized_intensity = emissivity_i * fraction
    stokes_q = polarized_intensity * (b_2.square() - b_1.square()) / denominator
    stokes_u = polarized_intensity * (-2.0 * b_1 * b_2) / denominator
    return stokes_q, stokes_u


def mhd_divergence_loss(
    magnetic_field: Tensor,
    spacing: Spacing = 1.0,
) -> Tensor:
    """Return mean ``(div B)²`` from centered 3-D finite differences.

    ``magnetic_field`` must have shape ``(batch, 3, depth, height, width)``.
    Channel components ``(Bx, By, Bz)`` are associated with spatial axes
    ``(depth, height, width)`` respectively. ``spacing`` is the positive voxel
    spacing in those same axes, either a scalar or a length-three sequence.
    Replicated padding supplies stable centered stencils at the volume edges.

    The scalar result is a differentiable physics regularizer; units are
    ``B² / length²``. It remains on the input tensor's device and dtype.
    """
    if magnetic_field.ndim != 5 or magnetic_field.shape[1] != 3:
        raise ValueError(
            "magnetic_field must have shape (batch, 3, depth, height, width)"
        )
    if not magnetic_field.is_floating_point():
        raise TypeError("magnetic_field must be a floating-point tensor")
    if any(size < 2 for size in magnetic_field.shape[-3:]):
        raise ValueError("each magnetic-field spatial dimension must be at least 2")

    voxel_spacing = torch.as_tensor(
        spacing,
        dtype=magnetic_field.dtype,
        device=magnetic_field.device,
    )
    if voxel_spacing.ndim == 0:
        voxel_spacing = voxel_spacing.expand(3)
    if voxel_spacing.shape != (3,):
        raise ValueError("spacing must be a scalar or a length-three sequence")
    if torch.any(~torch.isfinite(voxel_spacing)) or torch.any(voxel_spacing <= 0.0):
        raise ValueError("voxel spacing values must be finite and positive")

    # Each output channel differentiates its input channel along one array axis:
    # depth (D), height (H), then width (W). Constant kernels have no trainable
    # state, while conv3d retains gradients to every input voxel.
    kernels = torch.zeros(
        (3, 1, 3, 3, 3),
        dtype=magnetic_field.dtype,
        device=magnetic_field.device,
    )
    kernels[0, 0, 0, 1, 1] = -0.5
    kernels[0, 0, 2, 1, 1] = 0.5
    kernels[1, 0, 1, 0, 1] = -0.5
    kernels[1, 0, 1, 2, 1] = 0.5
    kernels[2, 0, 1, 1, 0] = -0.5
    kernels[2, 0, 1, 1, 2] = 0.5

    divergence = magnetic_field.new_zeros(
        (
            magnetic_field.shape[0],
            1,
            *magnetic_field.shape[-3:],
        )
    )
    for component, axis in enumerate(range(3)):
        component_field = magnetic_field[:, component : component + 1]
        padded = F.pad(component_field, (1, 1, 1, 1, 1, 1), mode="replicate")
        derivatives = F.conv3d(padded, kernels)
        spatial_axis = axis + 2
        axis_size = component_field.shape[spatial_axis]
        central = derivatives[:, axis : axis + 1]
        first = (
            component_field.select(spatial_axis, 1)
            - component_field.select(spatial_axis, 0)
        ).unsqueeze(spatial_axis) / voxel_spacing[axis]
        last = (
            component_field.select(spatial_axis, axis_size - 1)
            - component_field.select(spatial_axis, axis_size - 2)
        ).unsqueeze(spatial_axis) / voxel_spacing[axis]
        interior = central.narrow(spatial_axis, 1, axis_size - 2) / voxel_spacing[axis]
        derivative = torch.cat((first, interior, last), dim=spatial_axis)
        divergence = divergence + derivative

    return divergence.square().mean()


__all__ = [
    "mhd_divergence_loss",
    "project_magnetic_field_to_screen",
    "stokes_qu_from_magnetic_field",
]
