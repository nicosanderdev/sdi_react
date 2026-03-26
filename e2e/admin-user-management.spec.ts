/**
 * Admin user management E2E.
 * Uses real Supabase/backend; requires seeded admin (see e2e/README.md).
 * Created users stay in the database unless you remove them manually.
 */
import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin } from './utils/auth.setup';
import { E2E_NEW_USER_PASSWORD, uniqueTestEmail } from './fixtures/admin-user-data';

async function goToAdminUsersPage(page: Page): Promise<void> {
  await loginAsAdmin(page);
  await page.goto('/dashboard/admin/users', { waitUntil: 'load' });
  await expect(page.getByRole('heading', { name: /Administración de usuarios/i })).toBeVisible();
}

/** Wait until the users table region is present and initial fetch finished (spinner cleared). */
async function waitForUsersTableReady(page: Page): Promise<void> {
  const root = page.getByTestId('admin-users-table');
  await expect(root).toBeVisible({ timeout: 15000 });
  await expect(root.locator('.animate-spin')).toHaveCount(0, { timeout: 15000 });
}

function userRowByEmail(page: Page, email: string) {
  return page.getByTestId('admin-users-table').getByRole('row').filter({ hasText: email });
}

async function openCreateUserModal(page: Page): Promise<void> {
  await page.getByTestId('admin-users-create-button').click();
  await expect(page.getByTestId('admin-create-user-modal')).toBeVisible();
  await expect(page.getByRole('dialog', { name: /Create User/ })).toBeVisible();
}

async function submitCreateUserForm(page: Page, data: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<void> {
  await page.locator('#firstName').fill(data.firstName);
  await page.locator('#lastName').fill(data.lastName);
  await page.locator('#email').fill(data.email);
  await page.locator('#password').fill(data.password);
  await page.getByRole('button', { name: 'Create User' }).click();
}

async function createUserThroughUi(
  page: Page,
  data: { firstName: string; lastName: string; email: string; password: string },
): Promise<void> {
  await openCreateUserModal(page);
  await submitCreateUserForm(page, data);
  await expect(page.getByTestId('admin-create-user-modal')).toBeHidden({ timeout: 30000 });
}

async function createThroughUiAndAssertRow(
  page: Page,
  data: { firstName: string; lastName: string; email: string; password: string },
): Promise<void> {
  await createUserThroughUi(page, data);
  const row = userRowByEmail(page, data.email);
  await expect(row).toBeVisible({ timeout: 30000 });
  await expect(row).toContainText(data.email);
}

test.describe('Admin user management', () => {
  test('admin can create a new user', async ({ page }) => {
    const email = uniqueTestEmail();
    const firstName = 'E2E';
    const lastName = 'Create';

    await goToAdminUsersPage(page);
    await waitForUsersTableReady(page);

    await createThroughUiAndAssertRow(page, {
      firstName,
      lastName,
      email,
      password: E2E_NEW_USER_PASSWORD,
    });
  });

  test('admin can edit an existing user', async ({ page }) => {
    const email = uniqueTestEmail();
    const firstName = 'E2E';
    const lastName = 'EditMe';

    await goToAdminUsersPage(page);
    await waitForUsersTableReady(page);

    await createUserThroughUi(page, {
      firstName,
      lastName,
      email,
      password: E2E_NEW_USER_PASSWORD,
    });

    const row = userRowByEmail(page, email);
    await expect(row).toBeVisible({ timeout: 30000 });
    await row.getByRole('button', { name: 'Editar' }).click();

    await expect(page.getByTestId('admin-edit-user-modal')).toBeVisible();
    const firstNameInput = page.locator('#edit-first-name');
    await expect(firstNameInput).toBeEnabled({ timeout: 15000 });

    const newFirst = 'E2EUpdated';
    const newLast = 'Edited';
    await firstNameInput.fill(newFirst);
    await page.locator('#edit-last-name').fill(newLast);
    await page.getByRole('button', { name: 'Guardar' }).click();

    await expect(page.getByTestId('admin-edit-user-modal')).toBeHidden({ timeout: 30000 });

    const rowAfter = userRowByEmail(page, email);
    await expect(rowAfter).toBeVisible();
    await expect(rowAfter).toContainText(newFirst);
    await expect(rowAfter).toContainText(newLast);
  });
});
