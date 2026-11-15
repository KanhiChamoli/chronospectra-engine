import unittest

import torch

from backend.src.losses import (
    mhd_divergence_loss,
    project_magnetic_field_to_screen,
    stokes_qu_from_magnetic_field,
)


class MHDDivergenceLossTests(unittest.TestCase):
    def test_constant_field_is_divergence_free_and_differentiable(self) -> None:
        field = torch.ones(
            (2, 3, 5, 6, 7), dtype=torch.float64, requires_grad=True
        )
        loss = mhd_divergence_loss(field, spacing=(0.5, 1.0, 2.0))
        torch.testing.assert_close(loss, torch.zeros_like(loss), atol=0.0, rtol=0.0)
        gradient = torch.autograd.grad(loss, field)[0]
        self.assertTrue(torch.isfinite(gradient).all())

    def test_linear_component_field_has_expected_divergence(self) -> None:
        depth, height, width = torch.meshgrid(
            torch.arange(5, dtype=torch.float64),
            torch.arange(6, dtype=torch.float64),
            torch.arange(7, dtype=torch.float64),
            indexing="ij",
        )
        field = torch.stack((2.0 * depth, 3.0 * height, 4.0 * width))
        loss = mhd_divergence_loss(field.unsqueeze(0))
        torch.testing.assert_close(loss, torch.tensor(81.0, dtype=torch.float64))

    def test_cuda_device_when_available(self) -> None:
        if not torch.cuda.is_available():
            self.skipTest("CUDA is unavailable")
        field = torch.randn((1, 3, 4, 4, 4), device="cuda", requires_grad=True)
        loss = mhd_divergence_loss(field)
        self.assertEqual(loss.device.type, "cuda")
        loss.backward()
        self.assertTrue(torch.isfinite(field.grad).all())

    def test_rejects_bad_shapes_and_spacing(self) -> None:
        with self.assertRaises(ValueError):
            mhd_divergence_loss(torch.zeros((3, 8, 8)))
        with self.assertRaises(ValueError):
            mhd_divergence_loss(torch.zeros((1, 3, 3, 3, 3)), spacing=0.0)


class StokesPolarizationTests(unittest.TestCase):
    def test_projected_magnetic_components_and_stokes_sign(self) -> None:
        field = torch.tensor([[1.0, 0.0, 0.0]], dtype=torch.float64)
        ray = torch.tensor([[0.0, 0.0, 1.0]], dtype=torch.float64)
        basis = torch.tensor(
            [[[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]]], dtype=torch.float64
        )
        b1, b2 = project_magnetic_field_to_screen(field, ray, screen_basis=basis)
        torch.testing.assert_close(b1, torch.ones_like(b1))
        torch.testing.assert_close(b2, torch.zeros_like(b2))

        stokes_q, stokes_u = stokes_qu_from_magnetic_field(
            torch.tensor([4.0], dtype=torch.float64),
            field,
            ray,
            screen_basis=basis,
            polarization_fraction=0.5,
        )
        torch.testing.assert_close(stokes_q, torch.tensor([-2.0], dtype=torch.float64))
        torch.testing.assert_close(stokes_u, torch.zeros_like(stokes_u))

    def test_field_parallel_to_ray_has_zero_linear_polarization(self) -> None:
        field = torch.tensor([[0.0, 0.0, 3.0]], dtype=torch.float64)
        ray = torch.tensor([[0.0, 0.0, 1.0]], dtype=torch.float64)
        q, u = stokes_qu_from_magnetic_field(torch.ones(1, dtype=torch.float64), field, ray)
        torch.testing.assert_close(q, torch.zeros_like(q))
        torch.testing.assert_close(u, torch.zeros_like(u))

    def test_stokes_gradients_flow_to_field_and_intensity(self) -> None:
        field = torch.tensor(
            [[0.8, 0.4, 0.2]], dtype=torch.float64, requires_grad=True
        )
        intensity = torch.tensor([2.0], dtype=torch.float64, requires_grad=True)
        ray = torch.tensor([[0.0, 0.0, 1.0]], dtype=torch.float64)
        q, u = stokes_qu_from_magnetic_field(intensity, field, ray)
        grad_field, grad_intensity = torch.autograd.grad(
            q.sum() + u.sum(), (field, intensity)
        )
        self.assertTrue(torch.isfinite(grad_field).all())
        self.assertTrue(torch.isfinite(grad_intensity).all())
        self.assertGreater(float(grad_field.abs().sum()), 0.0)
        self.assertGreater(float(grad_intensity.abs().sum()), 0.0)

    def test_stokes_cuda_device_when_available(self) -> None:
        if not torch.cuda.is_available():
            self.skipTest("CUDA is unavailable")
        field = torch.randn((2, 3), device="cuda", requires_grad=True)
        intensity = torch.ones(2, device="cuda", requires_grad=True)
        direction = torch.tensor([[0.0, 0.0, 1.0]], device="cuda").expand(2, -1)
        q, u = stokes_qu_from_magnetic_field(intensity, field, direction)
        self.assertEqual(q.device.type, "cuda")
        (q + u).sum().backward()
        self.assertTrue(torch.isfinite(field.grad).all())


if __name__ == "__main__":
    unittest.main()
