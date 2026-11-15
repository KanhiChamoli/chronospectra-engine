"""Differentiable null-geodesic integration in Schwarzschild Kerr-Schild coordinates.

The coordinate order is ``(ct, x, y, z)`` and the metric signature is
``(-, +, +, +)``. Units are geometrized (``G = c = 1``), so ``mass`` and the
coordinates use the same length units. Inputs may have arbitrary batch
dimensions, e.g. ``(rays, 4)`` or ``(height, width, 4)``.

The Kerr-Schild form is regular at the Schwarzschild event horizon and never
uses spherical coordinates, so it remains suitable for top-down image views.
The physical singularity at the origin is rejected explicitly. Tensor
calculations are out-of-place; no ray state is detached or edited in-place, so
autograd can differentiate the trajectory with respect to its initial data.

Example:

    >>> x, p = rk4_step(x, p, step_size=0.01, mass=1.0)
    >>> positions, momenta = integrate_geodesic(x, p, steps=100, step_size=0.01)

The default null projection removes RK4 constraint drift after every full step.
It changes only ``p^0`` and is differentiable away from branch changes. It does
not make the time integrator symplectic or replace convergence checks.
"""

from __future__ import annotations

import math
from typing import TypeAlias

import torch
from torch import Tensor

Mass: TypeAlias = float | Tensor
StepSize: TypeAlias = float | Tensor

_DIMENSION = 4
_SINGULARITY_EPSILON = 1e-8


def _validate_state(position: Tensor, momentum: Tensor) -> None:
    if position.shape != momentum.shape or position.ndim < 1:
        raise ValueError("position and momentum must have the same (..., 4) shape")
    if position.shape[-1] != _DIMENSION:
        raise ValueError("the last position and momentum dimension must be 4")
    if not position.is_floating_point() or not momentum.is_floating_point():
        raise TypeError("position and momentum must use floating-point tensors")
    if position.device != momentum.device or position.dtype != momentum.dtype:
        raise ValueError("position and momentum must have matching dtype and device")


def _mass_tensor(mass: Mass, reference: Tensor) -> Tensor:
    mass_tensor = torch.as_tensor(
        mass, dtype=reference.dtype, device=reference.device
    )
    if torch.any(mass_tensor < 0):
        raise ValueError("mass must be non-negative")
    return mass_tensor


def schwarzschild_metric(
    position: Tensor,
    mass: Mass = 1.0,
    *,
    min_radius: float = _SINGULARITY_EPSILON,
) -> Tensor:
    """Return the exact Schwarzschild metric in Cartesian Kerr-Schild form.

    ``g = eta + (2M/r) l (x) l (x)``, where ``l_mu = (1, x_i/r)`` is a
    Cartesian null covector. The time coordinate is ``ct`` and the signature
    is ``(-, +, +, +)``.
    """
    if position.ndim < 1 or position.shape[-1] != _DIMENSION:
        raise ValueError("position must have shape (..., 4)")
    if not position.is_floating_point():
        raise TypeError("position must use a floating-point dtype")

    spatial_position = position[..., 1:]
    radius = torch.linalg.vector_norm(spatial_position, dim=-1)
    if torch.any(radius <= min_radius):
        raise ValueError(
            "a ray reached the Schwarzschild singularity guard; "
            "stop or mask the ray before evaluating the metric"
        )

    mass_tensor = _mass_tensor(mass, position)
    radial_unit = spatial_position / radius.unsqueeze(-1)
    null_covector = torch.cat(
        (torch.ones_like(radius).unsqueeze(-1), radial_unit), dim=-1
    )
    eta = torch.diag(position.new_tensor((-1.0, 1.0, 1.0, 1.0)))
    return eta + (
        (2.0 * mass_tensor / radius).unsqueeze(-1).unsqueeze(-1)
        * null_covector.unsqueeze(-1)
        * null_covector.unsqueeze(-2)
    )


def schwarzschild_inverse_metric(
    position: Tensor,
    mass: Mass = 1.0,
    *,
    min_radius: float = _SINGULARITY_EPSILON,
) -> Tensor:
    """Return the analytic inverse of :func:`schwarzschild_metric`.

    The Kerr-Schild inverse is ``g^mu_nu = eta^mu_nu - (2M/r) l^mu l^nu``;
    computing it directly avoids a batched matrix inverse at every RK stage.
    """
    if position.ndim < 1 or position.shape[-1] != _DIMENSION:
        raise ValueError("position must have shape (..., 4)")
    if not position.is_floating_point():
        raise TypeError("position must use a floating-point dtype")

    spatial_position = position[..., 1:]
    radius = torch.linalg.vector_norm(spatial_position, dim=-1)
    if torch.any(radius <= min_radius):
        raise ValueError(
            "a ray reached the Schwarzschild singularity guard; "
            "stop or mask the ray before evaluating the metric"
        )

    mass_tensor = _mass_tensor(mass, position)
    radial_unit = spatial_position / radius.unsqueeze(-1)
    null_vector = torch.cat(
        (-torch.ones_like(radius).unsqueeze(-1), radial_unit), dim=-1
    )
    eta = torch.diag(position.new_tensor((-1.0, 1.0, 1.0, 1.0)))
    return eta - (
        (2.0 * mass_tensor / radius).unsqueeze(-1).unsqueeze(-1)
        * null_vector.unsqueeze(-1)
        * null_vector.unsqueeze(-2)
    )


def christoffel_symbols(
    position: Tensor,
    mass: Mass = 1.0,
    *,
    min_radius: float = _SINGULARITY_EPSILON,
) -> Tensor:
    """Calculate ``Gamma^mu_{alpha beta}`` analytically in Cartesian coordinates.

    The derivative of the Kerr-Schild metric is formed from ``r``,
    ``n_i = x_i/r`` and ``d n_i / d x_j = (delta_ij - n_i n_j) / r``.
    The time derivatives vanish because the Schwarzschild metric is stationary.
    The returned shape is ``(..., 4, 4, 4)`` with axes ``(mu, alpha, beta)``.
    """
    if position.ndim < 1 or position.shape[-1] != _DIMENSION:
        raise ValueError("position must have shape (..., 4)")
    if not position.is_floating_point():
        raise TypeError("position must use a floating-point dtype")

    spatial_position = position[..., 1:]
    radius = torch.linalg.vector_norm(spatial_position, dim=-1)
    if torch.any(radius <= min_radius):
        raise ValueError(
            "a ray reached the Schwarzschild singularity guard; "
            "stop or mask the ray before evaluating Christoffel symbols"
        )

    mass_tensor = _mass_tensor(mass, position)
    radial_unit = spatial_position / radius.unsqueeze(-1)
    inverse_radius = radius.reciprocal()
    null_covector = torch.cat(
        (torch.ones_like(radius).unsqueeze(-1), radial_unit), dim=-1
    )

    # Derivative axis order is (coordinate derivative, first metric index,
    # second metric index). There is no derivative with respect to ct.
    identity3 = torch.eye(3, dtype=position.dtype, device=position.device)
    dn_dx = (
        identity3
        - radial_unit.unsqueeze(-1) * radial_unit.unsqueeze(-2)
    ) * inverse_radius[..., None, None]
    dk_dx = torch.cat(
        (torch.zeros_like(dn_dx[..., :1, :]), dn_dx), dim=-2
    ).transpose(-1, -2)
    d_inverse_radius = -radial_unit * inverse_radius.square().unsqueeze(-1)
    d_metric_spatial = (2.0 * mass_tensor)[..., None, None, None] * (
        d_inverse_radius[..., :, None, None]
        * null_covector[..., None, :, None]
        * null_covector[..., None, None, :]
        + inverse_radius[..., None, None, None]
        * (
            dk_dx[..., :, :, None] * null_covector[..., None, None, :]
            + null_covector[..., None, :, None] * dk_dx[..., :, None, :]
        )
    )
    d_metric = torch.cat(
        (torch.zeros_like(d_metric_spatial[..., :1, :, :]), d_metric_spatial),
        dim=-3,
    )

    inverse_metric = schwarzschild_inverse_metric(
        position, mass_tensor, min_radius=min_radius
    )
    # The three terms are respectively d_alpha g_sigma_beta,
    # d_beta g_sigma_alpha, and d_sigma g_alpha_beta.
    first = torch.einsum("...rs,...asb->...rab", inverse_metric, d_metric)
    second = torch.einsum("...rs,...bsa->...rab", inverse_metric, d_metric)
    third = torch.einsum("...rs,...sab->...rab", inverse_metric, d_metric)
    return 0.5 * (first + second - third)


def null_residual(position: Tensor, momentum: Tensor, mass: Mass = 1.0) -> Tensor:
    """Return ``g_mu_nu p^mu p^nu`` for each ray."""
    _validate_state(position, momentum)
    metric = schwarzschild_metric(position, mass)
    return torch.einsum("...i,...ij,...j->...", momentum, metric, momentum)


def _project_null_momentum(
    position: Tensor,
    momentum: Tensor,
    mass: Mass,
    *,
    min_radius: float = _SINGULARITY_EPSILON,
) -> Tensor:
    """Project momentum onto the local null cone by solving the quadratic for p^0.

    Spatial contravariant momentum is left unchanged. Both roots are evaluated
    and the one closest to the RK4-integrated time component is selected, which
    maintains the ray's time orientation continuously away from a branch change.
    The linear limit handles the Kerr-Schild coordinate surface where g_00=0.
    """
    metric = schwarzschild_metric(position, mass, min_radius=min_radius)
    p_spatial = momentum[..., 1:]
    a = metric[..., 0, 0]
    b = 2.0 * torch.einsum("...i,...i->...", metric[..., 0, 1:], p_spatial)
    c = torch.einsum(
        "...i,...ij,...j->...", p_spatial, metric[..., 1:, 1:], p_spatial
    )

    discriminant = b.square() - 4.0 * a * c
    tolerance = 64.0 * torch.finfo(momentum.dtype).eps * (
        b.square() + torch.abs(4.0 * a * c) + 1.0
    )
    if torch.any(discriminant < -tolerance):
        raise ValueError("momentum has no real null-cone projection at this position")
    root = torch.sqrt(torch.clamp_min(discriminant, 0.0))

    # Avoid evaluating a division by zero in the quadratic branch when a=0;
    # torch.where is differentiable only through the selected branch, but both
    # branches still need finite intermediate values.
    quadratic = torch.abs(a) > torch.finfo(momentum.dtype).eps
    safe_a = torch.where(quadratic, a, torch.ones_like(a))
    root_plus = (-b + root) / (2.0 * safe_a)
    root_minus = (-b - root) / (2.0 * safe_a)
    chosen_quadratic = torch.where(
        torch.abs(root_plus - momentum[..., 0])
        <= torch.abs(root_minus - momentum[..., 0]),
        root_plus,
        root_minus,
    )

    safe_b = torch.where(
        torch.abs(b) > torch.finfo(momentum.dtype).eps,
        b,
        torch.ones_like(b),
    )
    linear_root = -c / safe_b
    if torch.any((~quadratic) & (torch.abs(b) <= torch.finfo(momentum.dtype).eps)):
        raise ValueError("null-cone projection is degenerate at this ray state")
    p_time = torch.where(quadratic, chosen_quadratic, linear_root)
    return torch.cat((p_time.unsqueeze(-1), p_spatial), dim=-1)


def geodesic_rhs(
    position: Tensor,
    momentum: Tensor,
    mass: Mass = 1.0,
    *,
    min_radius: float = _SINGULARITY_EPSILON,
) -> tuple[Tensor, Tensor]:
    """Evaluate the first-order geodesic system ``(dx/dlambda, dp/dlambda)``."""
    _validate_state(position, momentum)
    gamma = christoffel_symbols(position, mass, min_radius=min_radius)
    acceleration = -torch.einsum(
        "...mab,...a,...b->...m", gamma, momentum, momentum
    )
    return momentum, acceleration


def _broadcast_step(step_size: StepSize, reference: Tensor) -> Tensor:
    step = torch.as_tensor(step_size, dtype=reference.dtype, device=reference.device)
    if step.ndim > reference.ndim - 1:
        raise ValueError("step_size must be scalar or broadcastable over ray batch axes")
    while step.ndim < reference.ndim:
        step = step.unsqueeze(-1)
    return step


def adaptive_step_size(
    step_size: StepSize,
    position: Tensor,
    mass: Mass = 1.0,
    *,
    photon_sphere_width: float = 2.0,
    min_fraction: float = 0.1,
    min_radius: float = _SINGULARITY_EPSILON,
) -> Tensor:
    """Scale each ray's step down near the Schwarzschild photon sphere ``r=3M``.

    The returned shape is ``(*batch_shape, 1)`` and is suitable for direct
    multiplication with four-vectors. The refinement is smooth in radius
    except at the configured floor; it is a visual integration heuristic, not
    an embedded local-error estimate. Set ``adaptive_step=False`` in
    :func:`integrate_geodesic` to retain fixed-step behavior.
    """
    if not math.isfinite(photon_sphere_width) or photon_sphere_width <= 0.0:
        raise ValueError("photon_sphere_width must be finite and positive")
    if not math.isfinite(min_fraction) or not 0.0 < min_fraction <= 1.0:
        raise ValueError("min_fraction must be finite and in (0, 1]")
    _validate_state(position, torch.zeros_like(position))

    base_step = _broadcast_step(step_size, position)
    radius = torch.linalg.vector_norm(position[..., 1:], dim=-1)
    mass_tensor = _mass_tensor(mass, position)
    width = photon_sphere_width * mass_tensor
    width = torch.clamp_min(width, min_radius)
    refinement = torch.clamp(
        torch.abs(radius - 3.0 * mass_tensor) / width,
        min=min_fraction,
        max=1.0,
    )
    refinement = torch.where(
        mass_tensor > 0.0, refinement, torch.ones_like(refinement)
    )
    return base_step * refinement.unsqueeze(-1)


def _termination_radius_tensor(
    termination_radius: float | Tensor | None,
    reference: Tensor,
    *,
    min_radius: float,
) -> Tensor:
    if termination_radius is None:
        cutoff = reference.new_full(
            reference.shape[:-1], max(2.0 * min_radius, _SINGULARITY_EPSILON)
        )
    else:
        cutoff = torch.as_tensor(
            termination_radius, dtype=reference.dtype, device=reference.device
        )
        try:
            torch.broadcast_shapes(cutoff.shape, reference.shape[:-1])
        except RuntimeError as exc:
            raise ValueError(
                "termination_radius must be scalar or broadcastable over ray batch axes"
            ) from exc
        if torch.any(~torch.isfinite(cutoff)) or torch.any(cutoff <= min_radius):
            raise ValueError("termination_radius must be finite and greater than min_radius")
    return cutoff


def _safe_position_for_active_rays(
    position: Tensor,
    active: Tensor,
    cutoff: Tensor,
    *,
    min_radius: float,
) -> Tensor:
    """Give inactive rays a finite guard location for vectorized RHS evaluation."""
    spatial = position[..., 1:]
    radius = torch.linalg.vector_norm(spatial, dim=-1)
    safe_direction = spatial / radius.clamp_min(min_radius).unsqueeze(-1)
    fallback = torch.zeros_like(spatial)
    fallback[..., 0] = 1.0
    safe_direction = torch.where(
        (radius > min_radius).unsqueeze(-1), safe_direction, fallback
    )
    guard_radius = torch.maximum(
        cutoff, cutoff.new_full(cutoff.shape, min_radius * 10.0)
    ) + min_radius * 10.0
    safe_spatial = safe_direction * guard_radius.unsqueeze(-1)
    evaluation_spatial = torch.where(active.unsqueeze(-1), spatial, safe_spatial)
    return torch.cat((position[..., :1], evaluation_spatial), dim=-1)


def _masked_geodesic_rhs(
    position: Tensor,
    momentum: Tensor,
    active: Tensor,
    cutoff: Tensor,
    mass: Mass,
    *,
    min_radius: float,
) -> tuple[Tensor, Tensor]:
    radius = torch.linalg.vector_norm(position[..., 1:], dim=-1)
    stage_active = (
        active
        & torch.isfinite(radius)
        & (radius > cutoff)
        & torch.isfinite(momentum).all(dim=-1)
    )
    safe_position = _safe_position_for_active_rays(
        position, stage_active, cutoff, min_radius=min_radius
    )
    safe_momentum = torch.where(
        stage_active.unsqueeze(-1), momentum, torch.zeros_like(momentum)
    )
    dx, dp = geodesic_rhs(
        safe_position, safe_momentum, mass, min_radius=min_radius
    )
    return (
        torch.where(stage_active.unsqueeze(-1), dx, torch.zeros_like(dx)),
        torch.where(stage_active.unsqueeze(-1), dp, torch.zeros_like(dp)),
    )


def _masked_rk4_step(
    position: Tensor,
    momentum: Tensor,
    step_size: Tensor,
    active: Tensor,
    cutoff: Tensor,
    mass: Mass,
    *,
    project_null: bool,
    min_radius: float,
) -> tuple[Tensor, Tensor, Tensor]:
    k1_x, k1_p = _masked_geodesic_rhs(
        position, momentum, active, cutoff, mass, min_radius=min_radius
    )
    k2_x, k2_p = _masked_geodesic_rhs(
        position + 0.5 * step_size * k1_x,
        momentum + 0.5 * step_size * k1_p,
        active,
        cutoff,
        mass,
        min_radius=min_radius,
    )
    k3_x, k3_p = _masked_geodesic_rhs(
        position + 0.5 * step_size * k2_x,
        momentum + 0.5 * step_size * k2_p,
        active,
        cutoff,
        mass,
        min_radius=min_radius,
    )
    k4_x, k4_p = _masked_geodesic_rhs(
        position + step_size * k3_x,
        momentum + step_size * k3_p,
        active,
        cutoff,
        mass,
        min_radius=min_radius,
    )
    candidate_position = position + (step_size / 6.0) * (
        k1_x + 2.0 * k2_x + 2.0 * k3_x + k4_x
    )
    candidate_momentum = momentum + (step_size / 6.0) * (
        k1_p + 2.0 * k2_p + 2.0 * k3_p + k4_p
    )

    candidate_radius = torch.linalg.vector_norm(
        candidate_position[..., 1:], dim=-1
    )
    candidate_finite = torch.isfinite(candidate_position).all(dim=-1) & torch.isfinite(
        candidate_momentum
    ).all(dim=-1)
    next_active = active & candidate_finite & torch.isfinite(candidate_radius) & (
        candidate_radius > cutoff
    )
    terminated = active & ~next_active

    current_spatial = position[..., 1:]
    candidate_spatial = candidate_position[..., 1:]
    candidate_direction = candidate_spatial / candidate_radius.clamp_min(
        min_radius
    ).unsqueeze(-1)
    current_radius = torch.linalg.vector_norm(current_spatial, dim=-1)
    current_direction = current_spatial / current_radius.clamp_min(
        min_radius
    ).unsqueeze(-1)
    fallback_direction = torch.zeros_like(current_spatial)
    fallback_direction[..., 0] = 1.0
    direction = torch.where(
        (candidate_radius > min_radius).unsqueeze(-1),
        candidate_direction,
        torch.where(
            (current_radius > min_radius).unsqueeze(-1),
            current_direction,
            fallback_direction,
        ),
    )
    boundary = direction * cutoff.unsqueeze(-1)
    terminated_time = torch.where(
        candidate_finite.unsqueeze(-1),
        candidate_position[..., :1],
        position[..., :1],
    )
    terminated_position = torch.cat((terminated_time, boundary), dim=-1)
    next_position = torch.where(
        terminated.unsqueeze(-1),
        terminated_position,
        torch.where(active.unsqueeze(-1), candidate_position, position),
    )
    next_momentum = torch.where(
        (active & candidate_finite).unsqueeze(-1),
        candidate_momentum,
        momentum,
    )

    if project_null:
        safe_position = _safe_position_for_active_rays(
            next_position, next_active, cutoff, min_radius=min_radius
        )
        projected = _project_null_momentum(
            safe_position, next_momentum, mass, min_radius=min_radius
        )
        next_momentum = torch.where(
            next_active.unsqueeze(-1), projected, next_momentum
        )
    return next_position, next_momentum, next_active


def rk4_step(
    position: Tensor,
    momentum: Tensor,
    step_size: StepSize,
    mass: Mass = 1.0,
    *,
    project_null: bool = True,
    min_radius: float = _SINGULARITY_EPSILON,
) -> tuple[Tensor, Tensor]:
    """Advance ray position and contravariant four-momentum by one RK4 step.

    Each ``k`` slope and intermediate state is constructed out-of-place. With
    ``project_null=True``, a differentiable time-component projection limits
    accumulated RK4 drift in the null constraint after the completed step.
    """
    _validate_state(position, momentum)
    step = _broadcast_step(step_size, position)

    # k_i = (dx/dlambda, dp/dlambda). No state tensor is mutated, preserving
    # every intermediate operation in PyTorch's reverse-mode autograd graph.
    k1_x, k1_p = geodesic_rhs(
        position, momentum, mass, min_radius=min_radius
    )
    k2_x, k2_p = geodesic_rhs(
        position + 0.5 * step * k1_x,
        momentum + 0.5 * step * k1_p,
        mass,
        min_radius=min_radius,
    )
    k3_x, k3_p = geodesic_rhs(
        position + 0.5 * step * k2_x,
        momentum + 0.5 * step * k2_p,
        mass,
        min_radius=min_radius,
    )
    k4_x, k4_p = geodesic_rhs(
        position + step * k3_x,
        momentum + step * k3_p,
        mass,
        min_radius=min_radius,
    )

    next_position = position + (step / 6.0) * (
        k1_x + 2.0 * k2_x + 2.0 * k3_x + k4_x
    )
    next_momentum = momentum + (step / 6.0) * (
        k1_p + 2.0 * k2_p + 2.0 * k3_p + k4_p
    )
    if project_null:
        next_momentum = _project_null_momentum(
            next_position, next_momentum, mass, min_radius=min_radius
        )
    return next_position, next_momentum


def integrate_geodesic(
    position: Tensor,
    momentum: Tensor,
    steps: int,
    step_size: StepSize,
    mass: Mass = 1.0,
    *,
    project_null: bool = True,
    min_radius: float = _SINGULARITY_EPSILON,
    terminate_radius: float | Tensor | None = None,
    adaptive_step: bool = True,
    photon_sphere_width: float = 2.0,
    min_step_fraction: float = 0.1,
    return_active_mask: bool = False,
) -> tuple[Tensor, Tensor] | tuple[Tensor, Tensor, Tensor]:
    """Integrate rays and return position/momentum history including the start.

    Returned tensors have shape ``(steps + 1, *batch_shape, 4)``. The Python
    loop intentionally stacks immutable states instead of preallocating and
    mutating a history tensor, which keeps the complete trajectory connected to
    autograd. When a ray reaches ``terminate_radius`` it is clamped to that
    radius and its state is held fixed for later steps; the optional Boolean
    history identifies active rays at each sample. If no radius is provided,
    the numerical singularity guard is used. For visual Schwarzschild renders,
    pass ``terminate_radius=2 * mass`` to stop rays at the event horizon.

    Adaptive stepping is enabled by default and reduces each ray's step near
    ``r=3M``. Set ``adaptive_step=False`` for a fixed-size scientific convergence
    study. This radial heuristic is not an embedded truncation-error estimator.
    """
    _validate_state(position, momentum)
    if not isinstance(steps, int) or isinstance(steps, bool) or steps < 0:
        raise ValueError("steps must be a non-negative integer")

    cutoff = _termination_radius_tensor(
        terminate_radius, position, min_radius=min_radius
    )
    current_radius = torch.linalg.vector_norm(position[..., 1:], dim=-1)
    active = torch.isfinite(current_radius) & (current_radius > cutoff)
    current_position = position
    if project_null:
        safe_position = _safe_position_for_active_rays(
            position, active, cutoff, min_radius=min_radius
        )
        projected_momentum = _project_null_momentum(
            safe_position, momentum, mass, min_radius=min_radius
        )
        current_momentum = torch.where(
            active.unsqueeze(-1), projected_momentum, momentum
        )
    else:
        current_momentum = momentum
    positions = [current_position]
    momenta = [current_momentum]
    active_history = [active]
    for _ in range(steps):
        if adaptive_step:
            step = adaptive_step_size(
                step_size,
                current_position,
                mass,
                photon_sphere_width=photon_sphere_width,
                min_fraction=min_step_fraction,
                min_radius=min_radius,
            )
        else:
            step = _broadcast_step(step_size, current_position)
        current_position, current_momentum, active = _masked_rk4_step(
            current_position,
            current_momentum,
            step,
            active,
            cutoff,
            mass,
            project_null=project_null,
            min_radius=min_radius,
        )
        positions.append(current_position)
        momenta.append(current_momentum)
        active_history.append(active)
    position_history = torch.stack(positions, dim=0)
    momentum_history = torch.stack(momenta, dim=0)
    if return_active_mask:
        return position_history, momentum_history, torch.stack(active_history, dim=0)
    return position_history, momentum_history


__all__ = [
    "Mass",
    "StepSize",
    "adaptive_step_size",
    "christoffel_symbols",
    "geodesic_rhs",
    "integrate_geodesic",
    "null_residual",
    "rk4_step",
    "schwarzschild_inverse_metric",
    "schwarzschild_metric",
]
