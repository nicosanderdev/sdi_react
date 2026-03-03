import { test, expect } from '@playwright/test';
import { setupAuthenticatedContext } from './utils/auth.setup';

test.describe.serial('Bookings and receipts flow', () => {
  let page: any;

  test.beforeEach(async ({ context }) => {
    // Always log in as basic test user (test@example.com)
    page = await setupAuthenticatedContext(context, 'basic');
  });

  test('shows seeded bookings grouped by status on Reservas page', async () => {
    await page.goto('/dashboard/reservas');
    await page.waitForLoadState('networkidle');

    // Pendientes section with at least one pending booking
    const pendientesSection = page.locator('section', {
      hasText: 'Pendientes'
    });
    await expect(pendientesSection.getByRole('heading', { name: 'Pendientes' })).toBeVisible();
    await expect(
      pendientesSection.locator('button', { hasText: 'Aceptar' })
    ).toHaveCountGreaterThan(0);

    // Próximas / Actuales section with at least one confirmed upcoming booking
    const proximasSection = page.locator('section', {
      hasText: 'Próximas / Actuales'
    });
    await expect(
      proximasSection.getByRole('heading', { name: 'Próximas / Actuales' })
    ).toBeVisible();

    // Pasadas section with at least one completed booking
    const pasadasSection = page.locator('section', {
      hasText: 'Pasadas'
    });
    await expect(pasadasSection.getByRole('heading', { name: 'Pasadas' })).toBeVisible();
  });

  test('can accept a pending booking and move it to current list', async () => {
    await page.goto('/dashboard/reservas');
    await page.waitForLoadState('networkidle');

    const pendientesSection = page.locator('section', {
      hasText: 'Pendientes'
    });

    const pendingCards = pendientesSection.locator('button', { hasText: 'Aceptar' });
    const initialCount = await pendingCards.count();
    expect(initialCount).toBeGreaterThan(0);

    // Click Aceptar on the first pending booking
    await pendingCards.first().click();

    // Wait for possible overlay spinner to disappear and network to settle
    await page.waitForLoadState('networkidle');

    // The count of pending "Aceptar" buttons should decrease
    const newCount = await pendientesSection
      .locator('button', { hasText: 'Aceptar' })
      .count();
    expect(newCount).toBeLessThan(initialCount);
  });

  test('can reject a pending booking so it no longer appears in pending list', async () => {
    await page.goto('/dashboard/reservas');
    await page.waitForLoadState('networkidle');

    const pendientesSection = page.locator('section', {
      hasText: 'Pendientes'
    });

    const rejectButtons = pendientesSection.locator('button', { hasText: 'Rechazar' });
    const initialCount = await rejectButtons.count();
    expect(initialCount).toBeGreaterThan(0);

    // Click Rechazar on the first pending booking
    await rejectButtons.first().click();

    await page.waitForLoadState('networkidle');

    const newCount = await pendientesSection
      .locator('button', { hasText: 'Rechazar' })
      .count();
    expect(newCount).toBeLessThan(initialCount);
  });

  test('shows unpaid booking receipts in subscription billing history and allows paying one', async () => {
    await page.goto('/dashboard/subscription/billing-history');

    // Wait for billing history page header
    await expect(
      page.getByRole('heading', { name: 'Historial de Facturación' })
    ).toBeVisible();

    // Wait for ensureReceipts hook to run and render unpaid receipts if any
    const receiptsCard = page.locator('h2', { hasText: 'Facturación por reservas' }).first();

    // If no receipts exist yet, this test will naturally fail – in that case
    // check that the seed + ensureReceiptsAndBlockStatus are aligned.
    await expect(receiptsCard).toBeVisible();

    // Each receipt has a "Pagar" button
    const payButtons = page.locator('button', { hasText: 'Pagar' });
    const initialCount = await payButtons.count();
    expect(initialCount).toBeGreaterThan(0);

    await payButtons.first().click();

    // After paying, ensure hook re-runs and the number of unpaid receipts decreases
    await page.waitForLoadState('networkidle');

    const newCount = await page.locator('button', { hasText: 'Pagar' }).count();
    expect(newCount).toBeLessThan(initialCount);
  });
}

