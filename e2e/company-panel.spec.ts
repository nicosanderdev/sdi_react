/**
 * Host company panel: create company, add/remove members, company-role RBAC.
 * Uses ephemeral auth users (service role). Requires local/cloud Supabase + the
 * 20260902180000 migration (create_company_for_current_member RPC).
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin, loginAsCredentials } from './utils/auth.setup';
import { createSupabaseServiceClient } from './utils/supabase-service';
import {
  addCompanyMembership,
  createCompanyForMember,
  createHostUser,
  deleteSeededCompany,
  deleteSeededUser,
} from './fixtures/company-panel-seed';

async function fillCreateCompanyForm(page: Page, name: string, billingEmail: string): Promise<void> {
  await expect(page.getByRole('dialog', { name: /Crear Nueva Compañía/i })).toBeVisible();
  await page.locator('#companyName').fill(name);
  await page.locator('#billingEmail').fill(billingEmail);
  await page.getByTestId('create-company-submit').click();
}

test.describe('Company panel — create company', () => {
  test('verified host can create a company and land on the company page', async ({ page }) => {
    const supabase = createSupabaseServiceClient();
    const host = await createHostUser(supabase, { firstName: 'Create', lastName: 'Admin' });
    const companyName = `E2E Create ${Date.now()}`;

    try {
      await loginAsCredentials(page, host.email, host.password);
      await page.goto('/dashboard/company', { waitUntil: 'load' });
      await expect(page.getByTestId('company-create-empty-state')).toBeVisible({ timeout: 20000 });
      await page.getByTestId('company-create-cta').click();
      await expect(page).toHaveURL(/\/dashboard\/company\/subscription/);
      await page.getByTestId('company-create-cta').click();
      await fillCreateCompanyForm(page, companyName, host.email);

      await expect(page).toHaveURL(/\/dashboard\/company$/, { timeout: 30000 });
      await expect(page.getByTestId('company-info-name')).toHaveText(companyName, { timeout: 20000 });
      await expect(page.getByTestId('company-role-label')).toContainText('Administrador');
      await expect(page.getByTestId('add-company-user-button')).toBeVisible();
    } finally {
      const { data: memberships } = await supabase
        .from('CompanyMembers')
        .select('CompanyId')
        .eq('MemberId', host.memberId)
        .eq('IsDeleted', false);
      for (const row of memberships ?? []) {
        await deleteSeededCompany(supabase, row.CompanyId);
      }
      await deleteSeededUser(supabase, host);
    }
  });

  test('unverified host cannot create a company', async ({ page }) => {
    const supabase = createSupabaseServiceClient();
    const host = await createHostUser(supabase, { verified: false, firstName: 'Unverified', lastName: 'Host' });

    try {
      await loginAsCredentials(page, host.email, host.password);
      await page.goto('/dashboard/company/subscription', { waitUntil: 'load' });
      await page.getByTestId('company-create-cta').click();
      await expect(page.getByText(/verificar tu correo electrónico y teléfono/i)).toBeVisible();
    } finally {
      await deleteSeededUser(supabase, host);
    }
  });

  test('platform admin is redirected away from /dashboard/company and can create from admin console', async ({ page }) => {
    const supabase = createSupabaseServiceClient();
    const companyName = `E2E Admin Co ${Date.now()}`;

    await loginAsAdmin(page);
    await page.goto('/dashboard/company', { waitUntil: 'load' });
    await expect(page).toHaveURL(/\/dashboard\/admin\/dashboard/);

    await page.goto('/dashboard/admin/companies', { waitUntil: 'load' });
    await page.getByTestId('admin-create-company-button').click();
    await page.locator('#admin-company-name').fill(companyName);
    await page.locator('#admin-company-billing-email').fill('admin-e2e@example.com');
    await page.getByTestId('admin-create-company-submit').click();
    await expect(page.getByText(companyName)).toBeVisible({ timeout: 20000 });

    const { data: created } = await supabase
      .from('Companies')
      .select('Id')
      .eq('Name', companyName)
      .maybeSingle();
    if (created?.Id) {
      await deleteSeededCompany(supabase, created.Id);
    }
  });
});

test.describe('Company panel — members and RBAC', () => {
  test('company Admin can add and remove a user', async ({ page }) => {
    const supabase = createSupabaseServiceClient();
    const admin = await createHostUser(supabase, { firstName: 'Co', lastName: 'Admin' });
    const invitee = await createHostUser(supabase, { firstName: 'Invited', lastName: 'Member' });
    const company = await createCompanyForMember(supabase, admin);

    try {
      await loginAsCredentials(page, admin.email, admin.password);
      await page.goto('/dashboard/company', { waitUntil: 'load' });
      await expect(page.getByTestId('add-company-user-button')).toBeVisible({ timeout: 20000 });
      await page.getByTestId('add-company-user-button').click();
      await page.locator('#email').fill(invitee.email);
      await page.getByTestId('add-company-user-submit').click();
      await expect(page.getByTestId(`company-user-row-${invitee.email}`)).toBeVisible({ timeout: 20000 });

      page.once('dialog', dialog => dialog.accept());
      await page.getByTestId(`company-user-remove-${invitee.email}`).click();
      await expect(page.getByTestId(`company-user-row-${invitee.email}`)).toHaveCount(0, { timeout: 20000 });
    } finally {
      await deleteSeededCompany(supabase, company.companyId);
      await deleteSeededUser(supabase, invitee);
      await deleteSeededUser(supabase, admin);
    }
  });

  test('company Manager cannot add or remove users', async ({ page }) => {
    const supabase = createSupabaseServiceClient();
    const admin = await createHostUser(supabase, { firstName: 'Owner', lastName: 'Admin' });
    const manager = await createHostUser(supabase, { firstName: 'Ops', lastName: 'Manager' });
    const company = await createCompanyForMember(supabase, admin);
    await addCompanyMembership(supabase, company.companyId, manager, 'Manager', admin.memberId);

    try {
      await loginAsCredentials(page, manager.email, manager.password);
      await page.goto('/dashboard/company', { waitUntil: 'load' });
      await expect(page.getByTestId('company-management-page')).toBeVisible({ timeout: 20000 });
      await expect(page.getByTestId('company-role-label')).toContainText('Manager');
      await expect(page.getByTestId('add-company-user-button')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Eliminar' })).toHaveCount(0);
    } finally {
      await deleteSeededCompany(supabase, company.companyId);
      await deleteSeededUser(supabase, manager);
      await deleteSeededUser(supabase, admin);
    }
  });

  test('company Member cannot add or remove users', async ({ page }) => {
    const supabase = createSupabaseServiceClient();
    const admin = await createHostUser(supabase, { firstName: 'Owner', lastName: 'Admin' });
    const member = await createHostUser(supabase, { firstName: 'Read', lastName: 'Member' });
    const company = await createCompanyForMember(supabase, admin);
    await addCompanyMembership(supabase, company.companyId, member, 'Member', admin.memberId);

    try {
      await loginAsCredentials(page, member.email, member.password);
      await page.goto('/dashboard/company', { waitUntil: 'load' });
      await expect(page.getByTestId('company-management-page')).toBeVisible({ timeout: 20000 });
      await expect(page.getByTestId('company-role-label')).toContainText('Miembro');
      await expect(page.getByTestId('add-company-user-button')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Eliminar' })).toHaveCount(0);
    } finally {
      await deleteSeededCompany(supabase, company.companyId);
      await deleteSeededUser(supabase, member);
      await deleteSeededUser(supabase, admin);
    }
  });
});
