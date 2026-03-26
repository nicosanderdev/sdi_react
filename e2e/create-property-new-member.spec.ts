/**
 * Admin property creation — owner = newly created member (AdminCreateMemberForm).
 *
 * Requires Supabase + create-member edge/function as in local dev.
 * Uses unique emails per run (see e2e/fixtures/admin-user-data.ts).
 */
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './utils/auth.setup';
import {
  attachConsoleErrorCollector,
  filterActionableConsoleErrors,
} from './utils/collect-console-errors';
import { E2E_NEW_USER_PASSWORD, uniqueTestEmail } from './fixtures/admin-user-data';
import { AdminCreatePropertyPom } from './pages/AdminCreatePropertyPage';
import { ADMIN_PROPERTY_TYPE_CASES, uniquePropertyTitle } from './fixtures/property-creation-data';

test.describe('Admin create property — new member', () => {
  test.describe.configure({ timeout: 180_000 });
  for (const propertyCase of ADMIN_PROPERTY_TYPE_CASES) {
    test(`creates ${propertyCase.listingType} for new member with image upload`, async ({
      page,
    }) => {
      const { errors: consoleErrors } = attachConsoleErrorCollector(page);
      const memberEmail = uniqueTestEmail();

      await loginAsAdmin(page);
      const pom = new AdminCreatePropertyPom(page);
      await pom.goto();
      await pom.chooseCreateNewMember();
      await pom.fillMinimalNewMember({
        email: memberEmail,
        password: E2E_NEW_USER_PASSWORD,
      });

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
  }
});
