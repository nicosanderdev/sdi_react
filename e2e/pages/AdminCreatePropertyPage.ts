import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { AddressFixture, AdminPropertyTypeCase } from '../fixtures/property-creation-data';
import { PROPERTY_IMAGE_FIXTURE, defaultAddress } from '../fixtures/property-creation-data';

/**
 * Page object for /dashboard/admin/properties/create (AdminCreatePropertyPage).
 * Assumes an authenticated admin session.
 */
export class AdminCreatePropertyPom {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/dashboard/admin/properties/create', { waitUntil: 'load' });
    await expect(this.page.getByRole('heading', { name: 'Nueva propiedad — Propietario' })).toBeVisible({
      timeout: 20000,
    });
  }

  async chooseExistingMember(): Promise<void> {
    await this.page.getByRole('radio', { name: /Usar miembro existente/ }).check();
  }

  async chooseCreateNewMember(): Promise<void> {
    await this.page.getByRole('radio', { name: /Crear nuevo miembro/ }).check();
  }

  async fillExistingMemberIdentifier(emailOrUuid: string): Promise<void> {
    await this.page.locator('#memberIdOrEmail').fill(emailOrUuid);
  }

  async clickUseMyEmail(): Promise<void> {
    await this.page.getByRole('button', { name: 'Usar mi email' }).click();
  }

  async continueFromOwnerPhase(): Promise<void> {
    await this.page.getByRole('button', { name: 'Continuar' }).click();
    await expect(this.page.getByText(/Nueva propiedad — Paso 1 de 4/)).toBeVisible({ timeout: 30000 });
  }

  async fillMinimalNewMember(opts: { email: string; password: string }): Promise<void> {
    await this.page.locator('#firstName').fill('E2E');
    await this.page.locator('#lastName').fill('Propietario');
    await this.page.locator('#email').fill(opts.email);
    await this.page.locator('#password').fill(opts.password);
    await this.page.getByRole('button', { name: 'Crear miembro' }).click();
    await expect(this.page.getByText(/Nueva propiedad — Paso 1 de 4/)).toBeVisible({ timeout: 60000 });
  }

  async waitForPropertyTypeLoaded(): Promise<void> {
    await expect(
      this.page.getByText('Cargando tipos de propiedad disponibles', { exact: false })
    ).toBeHidden({ timeout: 20000 });
  }

  /**
   * Admin dropdown labels: "Alquiler de temporada" (SummerRent), "Eventos" (EventVenue).
   */
  async selectPropertyType(label: string): Promise<void> {
    await this.waitForPropertyTypeLoaded();
    const block = this.page
      .locator('div.mb-6.flex.justify-end')
      .filter({ has: this.page.getByRole('heading', { name: 'Tipo de propiedad' }) });
    await block.getByRole('button').first().click();
    const option = this.page.getByRole('menuitem', { name: label });
    if ((await option.count()) > 0) {
      await option.click();
    } else {
      await this.page.getByRole('button', { name: label, exact: true }).click();
    }
    await expect(block.getByRole('button').first()).toContainText(label);
  }

  async fillStep1Address(address: AddressFixture = defaultAddress()): Promise<void> {
    await this.page.fill('#streetName', address.streetName);
    await this.page.fill('#houseNumber', address.houseNumber);
    await this.page.fill('#neighborhood', address.neighborhood);
    await this.page.fill('#city', address.city);
    await this.page.fill('#state', address.state);
    await this.page.fill('#zipCode', address.zipCode);
    await this.page.fill('#country', address.country);
    await this.page.waitForTimeout(1800);
    await this.page.locator('form').filter({ has: this.page.locator('#streetName') }).getByRole('button', { name: 'Siguiente' }).click();
    await expect(this.page.getByRole('heading', { name: 'Información Principal' })).toBeVisible();
  }

  async fillStep2CoreAndExtensions(opts: { title: string; case: AdminPropertyTypeCase }): Promise<void> {
    await this.page.fill('#title', opts.title);
    await this.page.fill('#areaValue', '120');
    await this.page.selectOption('#areaUnit', 'm²');
    await this.page.fill('#bedrooms', '2');
    await this.page.fill('#bathrooms', '1');
    await this.page.fill('#garageSpaces', '0');

    if (opts.case.listingType === 'SummerRent') {
      await this.page.fill('#minStayDays', '2');
      await this.page.fill('#maxStayDays', '21');
      await this.page.fill('#leadTimeDays', '1');
      await this.page.fill('#bufferDays', '1');
    } else {
      await this.page.fill('#maxGuests', '120');
      await this.page.fill('#closingHour', '23:00');
      await this.page.fill('#allowedEventsDescription', 'Casamientos y eventos corporativos (E2E)');
    }

    await this.page.locator('#onboarding-form-details').getByRole('button', { name: 'Siguiente' }).click();
  }

  async fillStep3UploadImages(imagePath: string = PROPERTY_IMAGE_FIXTURE): Promise<void> {
    const input = this.page.locator('#onboarding-form-photos input[type="file"]');
    await input.setInputFiles(imagePath);
    await expect(this.page.locator('#onboarding-form-photos img').first()).toBeVisible({ timeout: 10000 });
    await this.page.locator('#onboarding-form-photos').getByRole('button', { name: 'Siguiente' }).click();
  }

  async fillStep4Listing(listingType: 'SummerRent' | 'EventVenue'): Promise<void> {
    await this.page.selectOption('#listingType', listingType);
    await this.page.selectOption('#currency', 'USD');
    const today = new Date().toISOString().split('T')[0];
    await this.page.fill('#availableFrom', today);
    await this.page.fill('#rentPrice', '250');
    await this.page.fill('#capacity', '10');
    await this.page.selectOption('#status', 'rent');
    await this.page.getByRole('radio', { name: /Publicar ahora/ }).check();
  }

  async submitFinal(): Promise<void> {
    await this.page.getByRole('button', { name: 'Guardar Propiedad' }).click();
  }

  async expectAdminPropertiesList(): Promise<void> {
    await this.page.waitForURL('**/dashboard/admin/properties**', { timeout: 120000 });
    await expect(
      this.page.getByRole('heading', { name: /Gestión de propiedades/i })
    ).toBeVisible({ timeout: 20000 });
  }

  async expectTitleAppearsInList(title: string): Promise<void> {
    await expect(this.page.locator('table tbody td').filter({ hasText: title })).toBeVisible({
      timeout: 25000,
    });
  }

  /**
   * From property step 2: empty title should show schema error and not advance.
   */
  async expectTitleValidationBlocksProgress(): Promise<void> {
    await this.page.fill('#title', '');
    await this.page.locator('#onboarding-form-details').getByRole('button', { name: 'Siguiente' }).click();
    await expect(this.page.getByText('El título debe tener al menos 5 caracteres.')).toBeVisible();
  }
}
