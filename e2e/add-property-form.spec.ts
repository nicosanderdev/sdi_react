import { test, expect } from '@playwright/test';
import { getTestPropertyData, generateUniqueTitle } from './fixtures/property-data';
import { setupAuthenticatedContext, TEST_USERS } from './utils/auth.setup';

test.describe('Add Property Form', () => {
  let page: any;

  test.beforeEach(async ({ context }) => {
    // Setup authenticated context with basic user
    page = await setupAuthenticatedContext(context, 'basic');

    // Navigate to properties page where the "Nueva Propiedad" button is located
    await page.goto('/dashboard/properties');
    await page.waitForLoadState('networkidle');
  });

  test('should successfully create a new property through all 4 steps', async () => {
    // Get test data
    const propertyData = getTestPropertyData('apartmentForSale');
    const uniqueTitle = generateUniqueTitle(propertyData.title);

    // Step 1: Open the Add Property Form
    // Click the "Nueva Propiedad" button using the correct ID
    await page.click('#add-property-button');

    // Wait for the form to load (AddPropertyForm replaces the PropertiesManager component)
    await page.waitForSelector('h1:has-text("Nueva Propiedad - Paso 1 de 4")', { timeout: 5000 });

    // Verify we're on step 1
    await expect(page.locator('h1:has-text("Nueva Propiedad - Paso 1 de 4")')).toBeVisible();

    // Step 2: Fill Address Information (Step 1)
    await fillAddressStep(page, propertyData);

    // Click "Siguiente" to go to step 2
    await page.click('#next-step-button');

    // Verify we're on step 2
    await expect(page.locator('h3:has-text("Información Principal")')).toBeVisible();

    // Step 3: Fill Property Details (Step 2)
    await fillPropertyDetailsStep(page, { ...propertyData, title: uniqueTitle });

    // Click "Siguiente" to go to step 3
    await page.click('#next-step-button');

    // Verify we're on step 3 (Media step)
    // Since we're skipping uploads, just proceed to step 4
    await page.click('#next-step-button');

    // Step 4: Submit the form (Step 4)
    // Since we're skipping document uploads, directly submit
    await page.click('button:has-text("Guardar Propiedad")');

    // Wait for submission to complete
    await page.waitForLoadState('networkidle');

    // Step 5: Verify Success
    await verifySuccessSubmission(page);
  });

  test('should create a rental property', async () => {
    const propertyData = getTestPropertyData('houseForRent');
    const uniqueTitle = generateUniqueTitle(propertyData.title);

    // Open form and fill step 1
    await page.click('#add-property-button');
    await page.waitForSelector('h1:has-text("Nueva Propiedad - Paso 1 de 4")', { timeout: 5000 });

    await fillAddressStep(page, propertyData);
    await page.click('button:has-text("Siguiente")');

    // Fill step 2 with rental data
    await fillPropertyDetailsStep(page, { ...propertyData, title: uniqueTitle });
    await page.click('button:has-text("Siguiente")');

    // Skip step 3 and submit
    await page.click('button:has-text("Siguiente")');
    await page.click('button:has-text("Guardar Propiedad")');

    await verifySuccessSubmission(page);
  });

  test('should handle minimal valid property', async () => {
    const propertyData = getTestPropertyData('minimalValidProperty');
    const uniqueTitle = generateUniqueTitle(propertyData.title);

    // Open form and fill with minimal data
    await page.click('#add-property-button');
    await page.waitForSelector('h1:has-text("Nueva Propiedad - Paso 1 de 4")', { timeout: 5000 });

    await fillAddressStep(page, propertyData);
    await page.click('button:has-text("Siguiente")');

    await fillPropertyDetailsStep(page, { ...propertyData, title: uniqueTitle });
    await page.click('button:has-text("Siguiente")');

    // Skip step 3 and submit
    await page.click('button:has-text("Siguiente")');
    await page.click('button:has-text("Guardar Propiedad")');

    await verifySuccessSubmission(page);
  });
});

/**
 * Helper function to fill Step 1: Address Information
 */
async function fillAddressStep(page: any, data: any) {
  // Fill address fields
  await page.fill('#streetName', data.streetName);
  await page.fill('#houseNumber', data.houseNumber);
  await page.fill('#neighborhood', data.neighborhood || '');
  await page.fill('#city', data.city);
  await page.fill('#state', data.state);
  await page.fill('#zipCode', data.zipCode);
  await page.fill('#country', data.country);

  // Wait for geocoding to complete (debounced 100ms + API call)
  // The location should change from default Montevideo coordinates
  await page.waitForTimeout(2000); // Give extra time for geocoding

  // Verify location has changed from default (optional validation)
  // Note: This might need adjustment based on actual geocoding behavior
}

/**
 * Helper function to fill Step 2: Property Details
 */
async function fillPropertyDetailsStep(page: any, data: any) {
  // Basic information
  await page.fill('#title', data.title);
  await page.selectOption('#type', data.type);
  await page.selectOption('#status', data.status);

  // Area information
  await page.fill('#areaValue', data.areaValue.toString());
  await page.selectOption('#areaUnit', data.areaUnit);

  // Rooms
  await page.fill('#bedrooms', data.bedrooms.toString());
  await page.fill('#bathrooms', data.bathrooms.toString());

  // Availability and currency
  await page.fill('#availableFrom', data.availableFrom);
  await page.selectOption('#currency', data.currency);

  // Price fields (conditional based on status)
  if (data.status === 'sale') {
    await page.fill('#salePrice', data.salePrice);
  } else if (data.status === 'rent') {
    await page.fill('#rentPrice', data.rentPrice);
  }

  // Description
  if (data.description) {
    await page.fill('#description', data.description);
  }

  // Checkboxes
  await page.setChecked('#isPriceVisible', data.isPriceVisible);

  if (data.hasGarage) {
    await page.setChecked('#hasGarage', true);
    await page.fill('#garageSpaces', data.garageSpaces.toString());
  }

  if (data.hasCommonExpenses) {
    await page.setChecked('#hasCommonExpenses', true);
    await page.fill('#commonExpensesValue', data.commonExpensesValue);
  }

  await page.setChecked('#isWaterIncluded', data.isWaterIncluded);
  await page.setChecked('#isElectricityIncluded', data.isElectricityIncluded);

  // Wait for form validation to complete
  await page.waitForTimeout(500);
}

/**
 * Helper function to verify successful submission
 */
async function verifySuccessSubmission(page: any) {
  // Wait for success message to appear (SuccessDisplay component)
  await page.waitForSelector('h2:has-text("¡Registro de propiedad exitoso!")', {
    timeout: 30000
  });

  // Verify success message content
  await expect(page.locator('h2:has-text("¡Registro de propiedad exitoso!")')).toBeVisible();
  await expect(page.locator(':has-text("La propiedad ha sido registrada correctamente.")')).toBeVisible();

  // Wait for redirect to properties page (SuccessDisplay redirects after 2 seconds)
  await page.waitForURL('**/dashboard/properties**', { timeout: 10000 });

  // Verify we're back on the properties page
  await expect(page.locator(':has-text("Gestión de Propiedades")')).toBeVisible();
}
