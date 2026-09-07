/**
 * Manager panel: calendar blocks (UI + Excel) and inbound iCal.
 * Requires local/cloud Supabase plus migration 20260903220000.
 */
import { test, expect, type Page } from '@playwright/test';
import * as XLSX from 'xlsx';
import { loginAsCredentials } from './utils/auth.setup';
import { createSupabaseServiceClient, createSupabaseUserClient } from './utils/supabase-service';
import {
  cleanupManagerPanel,
  seedManagerPanel,
} from './fixtures/manager-panel-seed';
import { createHostUser, deleteSeededUser } from './fixtures/company-panel-seed';
import { randomUUID } from 'crypto';

async function openAvailability(page: Page, propertyId: string): Promise<void> {
  await page.goto(`/dashboard/property/${propertyId}/bookings`, { waitUntil: 'load' });
  await expect(page.getByTestId('property-availability-toggle')).toBeVisible({ timeout: 20000 });
  await page.getByTestId('property-availability-toggle').click();
}

function xlsxFile(rows: string[][]): { name: string; mimeType: string; buffer: Buffer } {
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Fecha Inicio', 'Fecha Fin', 'Tipo de Bloqueo', 'Título', 'Descripción'],
    ...rows,
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Bloqueos');
  const buffer = Buffer.from(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
  return {
    name: 'bloqueos-e2e.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
  };
}

test.describe('Manager calendar sync and blocks', () => {
  test('company manager can create a calendar block', async ({ page }) => {
    const supabase = createSupabaseServiceClient();
    const seed = await seedManagerPanel(supabase);
    const title = `E2E-block-${Date.now()}`;

    try {
      await loginAsCredentials(page, seed.manager.email, seed.manager.password);
      await openAvailability(page, seed.propertyId);
      await expect(page.getByTestId('new-availability-block')).toBeVisible({ timeout: 15000 });
      await page.getByTestId('new-availability-block').click();
      await page.getByLabel('Fecha Inicio').fill('2099-01-10');
      await page.getByLabel('Fecha Fin').fill('2099-01-12');
      await page.getByPlaceholder('Ej: Mantenimiento, Limpieza...').fill(title);
      await page.getByTestId('save-availability-block').click();
      await expect(page.getByText(title)).toBeVisible({ timeout: 15000 });

      const { data } = await supabase
        .from('AvailabilityBlocks')
        .select('Title, BlockType, IsDeleted')
        .eq('EstatePropertyId', seed.propertyId)
        .eq('Title', title)
        .eq('IsDeleted', false)
        .maybeSingle();
      expect(data?.Title).toBe(title);
    } finally {
      await cleanupManagerPanel(supabase, seed);
    }
  });

  test('company manager can bulk-upload blocks from xlsx', async ({ page }) => {
    const supabase = createSupabaseServiceClient();
    const seed = await seedManagerPanel(supabase);
    const title = `E2E-xlsx-${Date.now()}`;

    try {
      await loginAsCredentials(page, seed.manager.email, seed.manager.password);
      await openAvailability(page, seed.propertyId);
      await expect(page.getByTestId('upload-availability-blocks')).toBeVisible({ timeout: 15000 });
      await page.getByTestId('availability-blocks-file-input').setInputFiles(
        xlsxFile([['2099-02-01', '2099-02-03', 'propietario', title, 'e2e']]),
      );
      await expect(page.getByText(title)).toBeVisible({ timeout: 15000 });
    } finally {
      await cleanupManagerPanel(supabase, seed);
    }
  });

  test('company manager can save an Airbnb iCal URL', async ({ page }) => {
    const supabase = createSupabaseServiceClient();
    const seed = await seedManagerPanel(supabase);
    const calendarName = `E2E Airbnb ${Date.now()}`;

    try {
      await loginAsCredentials(page, seed.manager.email, seed.manager.password);
      await page.goto(`/dashboard/property/${seed.propertyId}/bookings`, { waitUntil: 'load' });
      await page.getByTestId('property-calendar-sync-tab').click();
      await expect(page.getByTestId('ical-add-first-calendar')).toBeVisible({ timeout: 15000 });
      await page.getByTestId('ical-add-first-calendar').click();
      await page.getByTestId('ical-calendar-name').fill(calendarName);
      await page.getByTestId('ical-feed-url').fill('https://example.com/e2e-airbnb.ics');
      await page.getByTestId('ical-save-integration').click();
      await expect(page.getByRole('heading', { name: calendarName })).toBeVisible({ timeout: 20000 });

      const { data } = await supabase
        .from('CalendarIntegrations')
        .select('PlatformType, ICalUrl, IsDeleted')
        .eq('EstatePropertyId', seed.propertyId)
        .eq('ExternalCalendarName', calendarName)
        .eq('IsDeleted', false)
        .maybeSingle();
      expect(data?.PlatformType).toBe(2);
      expect(data?.ICalUrl).toBe('https://example.com/e2e-airbnb.ics');
    } finally {
      await cleanupManagerPanel(supabase, seed);
    }
  });

  test('company member is view-only for blocks and iCal', async ({ page }) => {
    const supabase = createSupabaseServiceClient();
    const seed = await seedManagerPanel(supabase);

    try {
      await supabase.from('AvailabilityBlocks').insert({
        EstatePropertyId: seed.propertyId,
        IsAvailable: false,
        StartDate: '2099-04-01T00:00:00.000Z',
        EndDate: '2099-04-03T23:59:59.000Z',
        BlockType: 2,
        Source: 'internal',
        Title: 'Visible-to-member',
        IsReadOnly: false,
        ConflictFlagged: false,
        IsDeleted: false,
      });

      await loginAsCredentials(page, seed.member.email, seed.member.password);
      await openAvailability(page, seed.propertyId);
      await expect(page.getByText('Visible-to-member')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('new-availability-block')).toHaveCount(0);
      await expect(page.getByTestId('upload-availability-blocks')).toHaveCount(0);

      await page.getByTestId('property-calendar-sync-tab').click();
      await expect(page.getByTestId('ical-add-calendar')).toHaveCount(0);
      await expect(page.getByTestId('ical-add-first-calendar')).toHaveCount(0);
      await expect(page.getByTestId('ical-regenerate-export')).toHaveCount(0);

      const memberClient = await createSupabaseUserClient(seed.member.email, seed.member.password);
      const { error } = await memberClient.from('AvailabilityBlocks').insert({
        EstatePropertyId: seed.propertyId,
        IsAvailable: false,
        StartDate: '2099-05-01T00:00:00.000Z',
        EndDate: '2099-05-02T23:59:59.000Z',
        BlockType: 2,
        Source: 'internal',
        Title: 'member-should-fail',
        IsReadOnly: false,
        ConflictFlagged: false,
        IsDeleted: false,
      });
      expect(error).toBeTruthy();
    } finally {
      await cleanupManagerPanel(supabase, seed);
    }
  });

  test('personal owner can create a block on their own property', async ({ page }) => {
    const supabase = createSupabaseServiceClient();
    const owner = await createHostUser(supabase, { firstName: 'Solo', lastName: 'Owner' });
    const { data: ownerRow, error: ownerError } = await supabase
      .from('Owners')
      .insert({
        OwnerType: 'member',
        MemberId: owner.memberId,
        CompanyId: null,
        IsDeleted: false,
      })
      .select('Id')
      .single();
    if (ownerError) throw ownerError;

    const propertyId = randomUUID();
    const now = new Date().toISOString();
    const { error: propertyError } = await supabase.from('EstateProperties').insert({
      Id: propertyId,
      StreetName: `E2E Solo ${Date.now()}`,
      HouseNumber: '1',
      Neighborhood: 'Pocitos',
      City: 'Montevideo',
      State: 'Montevideo',
      ZipCode: '11300',
      Country: 'UY',
      LocationLatitude: -34.907,
      LocationLongitude: -56.149,
      Bedrooms: 1,
      Bathrooms: 1,
      HasGarage: false,
      GarageSpaces: 0,
      IsDeleted: false,
      OwnerId: ownerRow.Id,
      Created: now,
      CreatedBy: owner.authUserId,
      LastModified: now,
      LastModifiedBy: owner.authUserId,
    });
    if (propertyError) throw propertyError;
    await supabase.from('SummerRentExtension').insert({
      EstatePropertyId: propertyId,
      MinStayDays: 1,
      MaxStayDays: 14,
      CreatedBy: owner.authUserId,
      LastModifiedBy: owner.authUserId,
    });

    const title = `E2E-personal-${Date.now()}`;
    try {
      await loginAsCredentials(page, owner.email, owner.password);
      await openAvailability(page, propertyId);
      await expect(page.getByTestId('new-availability-block')).toBeVisible({ timeout: 15000 });
      await page.getByTestId('new-availability-block').click();
      await page.getByLabel('Fecha Inicio').fill('2099-06-01');
      await page.getByLabel('Fecha Fin').fill('2099-06-02');
      await page.getByPlaceholder('Ej: Mantenimiento, Limpieza...').fill(title);
      await page.getByTestId('save-availability-block').click();
      await expect(page.getByText(title)).toBeVisible({ timeout: 15000 });
    } finally {
      await supabase.from('AvailabilityBlocks').delete().eq('EstatePropertyId', propertyId);
      await supabase.from('SummerRentExtension').delete().eq('EstatePropertyId', propertyId);
      await supabase.from('EstateProperties').delete().eq('Id', propertyId);
      await supabase.from('Owners').delete().eq('Id', ownerRow.Id);
      await deleteSeededUser(supabase, owner);
    }
  });
});
