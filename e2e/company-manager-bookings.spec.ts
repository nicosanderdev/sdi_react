import { test, expect } from '@playwright/test';
import { loginAsCredentials } from './utils/auth.setup';
import { createSupabaseServiceClient } from './utils/supabase-service';
import {
  autoConfirmPaidBooking,
  cleanupManagerPanel,
  markBookingPaid,
  seedManagerPanel,
} from './fixtures/manager-panel-seed';

test.describe('Company manager bookings', () => {
  test('manager sees the real guest and can accept an unlinked pending booking', async ({ page }) => {
    const supabase = createSupabaseServiceClient();
    const seed = await seedManagerPanel(supabase);

    try {
      await loginAsCredentials(page, seed.manager.email, seed.manager.password);
      await page.goto('/dashboard/bookings', { waitUntil: 'load' });

      const pendingSection = page.locator('section', { hasText: 'Pendientes' });
      await expect(pendingSection.getByRole('heading', { name: 'Pendientes' })).toBeVisible({ timeout: 20000 });
      await expect(pendingSection.getByTestId('booking-guest-name')).toContainText(seed.guestName);
      await expect(pendingSection.getByRole('button', { name: 'Aceptar' })).toBeVisible();

      await pendingSection.getByRole('button', { name: 'Aceptar' }).click();
      await expect(page.locator('section', { hasText: 'Próximas / Actuales' }).getByTestId('booking-guest-name')).toContainText(
        seed.guestName,
        { timeout: 20000 },
      );
    } finally {
      await cleanupManagerPanel(supabase, seed);
    }
  });

  test('company admin can view the same company booking', async ({ page }) => {
    const supabase = createSupabaseServiceClient();
    const seed = await seedManagerPanel(supabase);

    try {
      await loginAsCredentials(page, seed.admin.email, seed.admin.password);
      await page.goto('/dashboard/bookings', { waitUntil: 'load' });
      const pendingSection = page.locator('section', { hasText: 'Pendientes' });
      await expect(pendingSection.getByTestId('booking-guest-name')).toContainText(seed.guestName, { timeout: 20000 });
      await expect(pendingSection.getByRole('button', { name: 'Aceptar' })).toBeVisible();
    } finally {
      await cleanupManagerPanel(supabase, seed);
    }
  });

  test('linked Mercado Pago plus paid auto-confirms without Aceptar', async ({ page }) => {
    const supabase = createSupabaseServiceClient();
    const seed = await seedManagerPanel(supabase, { connectMercadoPago: true });

    try {
      await markBookingPaid(supabase, seed.pendingBookingId);
      const result = await autoConfirmPaidBooking(supabase, seed.pendingBookingId);
      expect(result.confirmed).toBe(true);

      await loginAsCredentials(page, seed.manager.email, seed.manager.password);
      await page.goto('/dashboard/bookings', { waitUntil: 'load' });

      const upcoming = page.locator('section', { hasText: 'Próximas / Actuales' });
      await expect(upcoming.getByTestId('booking-guest-name')).toContainText(seed.guestName, { timeout: 20000 });
      await expect(page.locator('section', { hasText: 'Pendientes' }).getByRole('button', { name: 'Aceptar' })).toHaveCount(0);
    } finally {
      await cleanupManagerPanel(supabase, seed);
    }
  });

  test('unlinked paid booking stays pending until Aceptar', async ({ page }) => {
    const supabase = createSupabaseServiceClient();
    const seed = await seedManagerPanel(supabase);

    try {
      await markBookingPaid(supabase, seed.pendingBookingId);
      const result = await autoConfirmPaidBooking(supabase, seed.pendingBookingId);
      expect(result.confirmed).toBeFalsy();
      expect(result.skipped_reason).toBe('seller_not_connected');

      await loginAsCredentials(page, seed.manager.email, seed.manager.password);
      await page.goto('/dashboard/bookings', { waitUntil: 'load' });
      const pendingSection = page.locator('section', { hasText: 'Pendientes' });
      await expect(pendingSection.getByRole('button', { name: 'Aceptar' })).toBeVisible({ timeout: 20000 });
    } finally {
      await cleanupManagerPanel(supabase, seed);
    }
  });
});
