/**
 * Admin property creation — owner = existing member (email / UUID).
 *
 * Login: admin (ADMIN_USER_*). Owners are seeded once via the real "Crear nuevo miembro" UI so the
 * "existing member" lookup is deterministic without DB scripts. Avoids admin-at-quota and missing test@ users.
 *
 * Optional: E2E_EXISTING_MEMBER_EMAIL skips seeding; that account must exist and allow two
 *   properties if both parametrized cases run (serial).
 *
 * UI labels: Event venue type is "Eventos" (not "Locales").
 */
import { test, expect, type Browser } from '@playwright/test';
import { loginAsAdmin } from './utils/auth.setup';
import {
  attachConsoleErrorCollector,
  filterActionableConsoleErrors,
} from './utils/collect-console-errors';
import { E2E_NEW_USER_PASSWORD, uniqueTestEmail } from './fixtures/admin-user-data';
import { AdminCreatePropertyPom } from './pages/AdminCreatePropertyPage';
import { ADMIN_PROPERTY_TYPE_CASES, uniquePropertyTitle } from './fixtures/property-creation-data';

/** One email per parametrized case when we seed via UI. */
let seededMemberEmails: string[] = [];

async function seedMemberEmails(browser: Browser): Promise<void> {
  seededMemberEmails = [];
  for (let i = 0; i < ADMIN_PROPERTY_TYPE_CASES.length; i++) {
    const page = await browser.newPage();
    const email = uniqueTestEmail();
    await loginAsAdmin(page);
    const pom = new AdminCreatePropertyPom(page);
    await pom.goto();
    await pom.chooseCreateNewMember();
    await pom.fillMinimalNewMember({ email, password: E2E_NEW_USER_PASSWORD });
    seededMemberEmails.push(email);
    await page.close();
  }
}

test.describe('Admin create property — existing member', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test.beforeAll(async ({ browser }) => {
    const fromEnv = process.env.E2E_EXISTING_MEMBER_EMAIL?.trim();
    if (fromEnv) {
      seededMemberEmails = ADMIN_PROPERTY_TYPE_CASES.map(() => fromEnv);
      return;
    }
    await seedMemberEmails(browser);
  });

  ADMIN_PROPERTY_TYPE_CASES.forEach((propertyCase, index) => {
    test(`creates ${propertyCase.listingType} with image upload and lists property`, async ({
      page,
    }) => {
      const { errors: consoleErrors } = attachConsoleErrorCollector(page);

      await loginAsAdmin(page);
      const pom = new AdminCreatePropertyPom(page);
      await pom.goto();
      await pom.chooseExistingMember();
      await pom.fillExistingMemberIdentifier(seededMemberEmails[index]!);

      await pom.continueFromOwnerPhase();

      const title = uniquePropertyTitle(propertyCase.titlePrefix);
      await pom.selectPropertyType(propertyCase.propertyTypeLabel);
      await pom.fillStep1Address();
      await pom.fillStep2CoreAndExtensions({ title, case: propertyCase });
      await pom.fillStep3UploadImages();
      await pom.fillStep4Listing(propertyCase.listingType);
      await pom.submitFinal();

      await pom.expectAdminPropertiesList();
      await pom.expectTitleAppearsInList(title);

      const critical = filterActionableConsoleErrors(consoleErrors);
      expect(critical, critical.join('\n')).toEqual([]);
    });
  });

  test('step 2 shows validation when title is empty', async ({ page }) => {
    await loginAsAdmin(page);
    const pom = new AdminCreatePropertyPom(page);
    await pom.goto();
    await pom.chooseExistingMember();
    await pom.fillExistingMemberIdentifier(seededMemberEmails[0]!);

    await pom.continueFromOwnerPhase();
    await pom.selectPropertyType('Eventos');
    await pom.fillStep1Address();
    await pom.expectTitleValidationBlocksProgress();
  });
});
