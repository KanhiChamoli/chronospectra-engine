import unittest

import torch

from backend.src.ray_marcher import (
    adaptive_step_size,
    christoffel_symbols,
    integrate_geodesic,
    null_residual,
    rk4_step,
    schwarzschild_inverse_metric,
    schwarzschild_metric,
)


class SchwarzschildMetricTests(unittest.TestCase):
    def setUp(self) -> None:
        self.position = torch.tensor(
            [0.0, 5.0, 1.0, 0.3], dtype=torch.float64, requires_grad=True
        )

    def test_metric_and_analytic_inverse(self) -> None:
        metric = schwarzschild_metric(self.position, mass=1.0)
        inverse = schwarzschild_inverse_metric(self.position, mass=1.0)
        identity = metric @ inverse
        torch.testing.assert_close(
            identity, torch.eye(4, dtype=torch.float64), rtol=1e-12, atol=1e-12
        )

    def test_christoffels_match_metric_derivatives(self) -> None:
        inverse = schwarzschild_inverse_metric(self.position, mass=1.0)
        derivative = torch.autograd.functional.jacobian(
            lambda value: schwarzschild_metric(value, mass=1.0), self.position
        ).permute(2, 0, 1)
        expected = 0.5 * (
            torch.einsum("rs,asb->rab", inverse, derivative)
            + torch.einsum("rs,bsa->rab", inverse, derivative)
            - torch.einsum("rs,sab->rab", inverse, derivative)
        )
        actual = christoffel_symbols(self.position, mass=1.0)
        torch.testing.assert_close(actual, expected, rtol=1e-12, atol=1e-12)
        torch.testing.assert_close(
            actual, actual.transpose(-1, -2), rtol=0.0, atol=1e-12
        )

    def test_flat_limit_has_no_connection(self) -> None:
        connection = christoffel_symbols(self.position, mass=0.0)
        torch.testing.assert_close(connection, torch.zeros_like(connection))


class GeodesicIntegrationTests(unittest.TestCase):
    def test_rk4_fourth_order_step_refinement(self) -> None:
        initial_position = torch.tensor(
            [[0.0, 10.0, 1.0, 0.2]], dtype=torch.float64
        )
        initial_momentum = torch.tensor(
            [[1.0, -0.7, 0.15, 0.05]], dtype=torch.float64
        )

        def advance(step_size: float, steps: int) -> tuple[torch.Tensor, torch.Tensor]:
            position, momentum = initial_position, initial_momentum
            for _ in range(steps):
                position, momentum = rk4_step(
                    position,
                    momentum,
                    step_size,
                    mass=1.0,
                    project_null=False,
                )
            return position, momentum

        coarse = advance(0.2, 1)
        fine = advance(0.1, 2)
        finer = advance(0.05, 4)
        coarse_error = torch.cat(
            ((coarse[0] - fine[0]).flatten(), (coarse[1] - fine[1]).flatten())
        ).norm()
        fine_error = torch.cat(
            ((fine[0] - finer[0]).flatten(), (fine[1] - finer[1]).flatten())
        ).norm()
        self.assertGreater(float(coarse_error / fine_error), 14.0)

    def test_rk4_preserves_null_constraint_and_gradients(self) -> None:
        position = torch.tensor(
            [[0.0, 10.0, 1.0, 0.0]], dtype=torch.float64, requires_grad=True
        )
        momentum = torch.tensor(
            [[1.0, -0.5, 0.2, 0.1]], dtype=torch.float64, requires_grad=True
        )
        original_position = position.detach().clone()
        original_momentum = momentum.detach().clone()

        positions, momenta = integrate_geodesic(
            position, momentum, steps=12, step_size=0.01, mass=1.0
        )
        residual = null_residual(positions, momenta, mass=1.0)
        self.assertLess(float(residual.abs().max().detach()), 1e-12)
        self.assertFalse(torch.equal(positions[-1], position))
        self.assertTrue(torch.equal(position, original_position))
        self.assertTrue(torch.equal(momentum, original_momentum))

        loss = positions[-1].square().sum() + momenta[-1].square().sum()
        grad_position, grad_momentum = torch.autograd.grad(
            loss, (position, momentum)
        )
        self.assertTrue(torch.isfinite(grad_position).all())
        self.assertTrue(torch.isfinite(grad_momentum).all())
        self.assertGreater(float(grad_position.abs().sum()), 0.0)
        self.assertGreater(float(grad_momentum.abs().sum()), 0.0)

        trainable_mass = torch.tensor(1.0, dtype=torch.float64, requires_grad=True)
        next_position, next_momentum = rk4_step(
            position, momentum, 0.01, mass=trainable_mass
        )
        mass_gradient = torch.autograd.grad(
            next_position.square().sum() + next_momentum.square().sum(),
            trainable_mass,
        )[0]
        self.assertTrue(torch.isfinite(mass_gradient))
        self.assertGreater(float(mass_gradient.abs()), 0.0)

    def test_flat_space_step_is_exactly_linear(self) -> None:
        position = torch.tensor([[0.0, 4.0, 1.0, 0.5]], dtype=torch.float64)
        momentum = torch.tensor([[1.0, -1.0, 0.0, 0.0]], dtype=torch.float64)
        step_size = 0.25
        next_position, next_momentum = rk4_step(
            position, momentum, step_size, mass=0.0
        )
        torch.testing.assert_close(
            next_position, position + step_size * momentum, rtol=0.0, atol=1e-14
        )
        torch.testing.assert_close(next_momentum, momentum, rtol=0.0, atol=1e-14)

    def test_null_projection_is_regular_at_horizon(self) -> None:
        position = torch.tensor([[0.0, 2.0, 0.0, 0.0]], dtype=torch.float64)
        momentum = torch.tensor([[0.0, 1.0, 0.0, 0.0]], dtype=torch.float64)
        next_position, next_momentum = rk4_step(
            position, momentum, 0.0, mass=1.0
        )
        torch.testing.assert_close(
            null_residual(next_position, next_momentum, mass=1.0),
            torch.zeros(1, dtype=torch.float64),
            rtol=0.0,
            atol=1e-14,
        )

    def test_batched_step_sizes_and_cuda_device(self) -> None:
        positions = torch.tensor(
            [[0.0, 10.0, 1.0, 0.0], [0.0, 12.0, 2.0, 0.0]],
            dtype=torch.float64,
        )
        momenta = torch.tensor(
            [[1.0, -0.5, 0.2, 0.1], [1.0, -0.4, 0.3, 0.1]],
            dtype=torch.float64,
        )
        next_positions, next_momenta = rk4_step(
            positions,
            momenta,
            torch.tensor([0.01, 0.02], dtype=torch.float64),
            mass=1.0,
        )
        self.assertEqual(next_positions.shape, positions.shape)
        self.assertEqual(next_momenta.shape, momenta.shape)

        if torch.cuda.is_available():
            cuda_positions, cuda_momenta = rk4_step(
                positions.cuda(), momenta.cuda(), 0.01, mass=1.0
            )
            self.assertEqual(cuda_positions.device.type, "cuda")
            self.assertEqual(cuda_momenta.device.type, "cuda")

    def test_adaptive_steps_shrink_near_the_photon_sphere(self) -> None:
        positions = torch.tensor(
            [[0.0, 3.0, 0.0, 0.0], [0.0, 10.0, 0.0, 0.0]],
            dtype=torch.float64,
        )
        steps = adaptive_step_size(0.2, positions, mass=1.0)
        self.assertAlmostEqual(float(steps[0, 0]), 0.02)
        self.assertAlmostEqual(float(steps[1, 0]), 0.2)

    def test_integration_terminates_only_the_captured_ray(self) -> None:
        positions = torch.tensor(
            [[0.0, 2.2, 0.0, 0.0], [0.0, 8.0, 0.0, 0.0]],
            dtype=torch.float64,
        )
        momenta = torch.tensor(
            [[1.0, -0.5, 0.0, 0.0], [1.0, -0.2, 0.0, 0.0]],
            dtype=torch.float64,
        )
        position_history, momentum_history, active_history = integrate_geodesic(
            positions,
            momenta,
            steps=8,
            step_size=1.0,
            mass=1.0,
            terminate_radius=2.0,
            project_null=False,
            return_active_mask=True,
        )
        self.assertEqual(tuple(active_history.shape), (9, 2))
        self.assertFalse(bool(active_history[-1, 0]))
        self.assertTrue(bool(active_history[-1, 1]))
        self.assertTrue(torch.isfinite(position_history).all())
        self.assertTrue(torch.isfinite(momentum_history).all())
        terminated_radius = torch.linalg.vector_norm(
            position_history[-1, 0, 1:]
        )
        torch.testing.assert_close(
            terminated_radius, torch.tensor(2.0, dtype=torch.float64)
        )
        torch.testing.assert_close(
            position_history[-1, 0], position_history[-2, 0]
        )
        torch.testing.assert_close(
            momentum_history[-1, 0], momentum_history[-2, 0]
        )


if __name__ == "__main__":
    unittest.main()
