/**
 * Admin Reservas E2E: seeds Bookings via service role, then exercises AdminBookingsPage.
 * Reject / Cancel map to Status Cancelled (2) in DB and badge "Cancelled".
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin } from './utils/auth.setup';
import { createSupabaseServiceClient } from './utils/supabase-service';
import {
  createReservation,
  deleteReservation,
  futureStayDates,
} from './fixtures/reservation-seed';

const PENDING = 0;
const CONFIRMED = 1;

async function goToAdminBookings(page: Page): Promise<void> {
  await loginAsAdmin(page);
  await page.goto('/dashboard/admin/bookings', { waitUntil: 'load' });
  await expect(page.getByTestId('admin-bookings-page')).toBeVisible({ timeout: 20000 });
}

function statusFilter(page: Page) {
  return page.getByTestId('admin-bookings-status-filter').locator('select');
}

async function waitForActionIdle(page: Page): Promise<void> {
  await expect(page.getByTestId('admin-bookings-action-overlay')).toBeHidden({
    timeout: 30000,
  });
}

test.describe('Admin reservations', () => {
  test('admin can confirm a pending booking', async ({ page }) => {
    const supabase = createSupabaseServiceClient();
    const dates = futureStayDates(14);
    const { bookingId } = await createReservation(supabase, {
      status: PENDING,
      checkIn: dates.checkIn,
      checkOut: dates.checkOut,
    });

    try {
      await goToAdminBookings(page);
      await statusFilter(page).selectOption('pending');
      const row = page.getByTestId(`reservation-${bookingId}`);
      await expect(row).toBeVisible({ timeout: 20000 });
      await expect(row).toContainText('Pending');
      await row.getByRole('button', { name: 'Aceptar' }).click();
      await waitForActionIdle(page);
      await expect(row.getByText('Confirmed', { exact: true })).toBeVisible();

      await statusFilter(page).selectOption('current');
      const rowUpcoming = page.getByTestId(`reservation-${bookingId}`);
      await expect(rowUpcoming).toBeVisible();
      await expect(rowUpcoming).toContainText('Confirmed');
    } finally {
      await deleteReservation(supabase, bookingId);
    }
  });

  test('admin can reject a pending booking (status Cancelled in UI)', async ({ page }) => {
    const supabase = createSupabaseServiceClient();
    const dates = futureStayDates(16);
    const { bookingId } = await createReservation(supabase, {
      status: PENDING,
      checkIn: dates.checkIn,
      checkOut: dates.checkOut,
    });

    try {
      await goToAdminBookings(page);
      await statusFilter(page).selectOption('pending');
      const rowPending = page.getByTestId(`reservation-${bookingId}`);
      await expect(rowPending).toBeVisible({ timeout: 20000 });
      await rowPending.getByRole('button', { name: 'Rechazar' }).click();
      await page.getByTestId('admin-bookings-modal-confirm').click();
      await waitForActionIdle(page);

      await statusFilter(page).selectOption('pending');
      await expect(page.getByTestId(`reservation-${bookingId}`)).toHaveCount(0);

      await statusFilter(page).selectOption('rejected');
      const rowRejected = page.getByTestId(`reservation-${bookingId}`);
      await expect(rowRejected).toBeVisible();
      await expect(rowRejected).toContainText('Cancelled');
    } finally {
      await deleteReservation(supabase, bookingId);
    }
  });

  test('admin can cancel an upcoming confirmed booking', async ({ page }) => {
    const supabase = createSupabaseServiceClient();
    const dates = futureStayDates(20);
    const { bookingId } = await createReservation(supabase, {
      status: CONFIRMED,
      checkIn: dates.checkIn,
      checkOut: dates.checkOut,
    });

    try {
      await goToAdminBookings(page);
      await statusFilter(page).selectOption('current');
      const rowCurrent = page.getByTestId(`reservation-${bookingId}`);
      await expect(rowCurrent).toBeVisible({ timeout: 20000 });
      await expect(rowCurrent).toContainText('Confirmed');
      await rowCurrent.getByRole('button', { name: 'Cancelar' }).click();
      await page.getByTestId('admin-bookings-modal-confirm').click();
      await waitForActionIdle(page);

      await statusFilter(page).selectOption('current');
      await expect(page.getByTestId(`reservation-${bookingId}`)).toHaveCount(0);

      await statusFilter(page).selectOption('rejected');
      const rowCancelled = page.getByTestId(`reservation-${bookingId}`);
      await expect(rowCancelled).toBeVisible();
      await expect(rowCancelled).toContainText('Cancelled');
    } finally {
      await deleteReservation(supabase, bookingId);
    }
  });
});
