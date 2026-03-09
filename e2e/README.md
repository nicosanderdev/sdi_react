# End-to-End Tests

This directory contains Playwright end-to-end tests for the real estate application.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the project root with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here
```

### 3. Database Setup

Run the migrations to create test accounts and booking data:

```bash
# Apply all migrations to your Supabase database
# This can be done through the Supabase dashboard SQL editor or CLI
supabase db reset  # This will run all migrations including the test users and e2e booking data
```

### Test User Credentials

Set up test user credentials in your `.env.local` file (optional - defaults provided):

```env
# Test user credentials for Playwright e2e tests (optional)
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123

# Admin user credentials (if available)
ADMIN_USER_EMAIL=admin@testcompany.com
ADMIN_USER_PASSWORD=adminpassword123
```

Or run the migration `20251222100000_add_test_users_for_e2e.sql` which creates:

- **Basic User**: `test@example.com` / `testpassword123`
- **Company Admin**: `admin@testcompany.com` / `adminpassword123`

### 4. Run Tests

```bash
# Run all e2e tests
npx playwright test

# Run specific test file
npx playwright test e2e/add-property-form.spec.ts

# Run tests in headed mode (see browser)
npx playwright test --headed

# Generate test report
npx playwright show-report
```

## Test Structure

### Authentication
- Tests use pre-configured test users created by the migration
- Authentication state is cached between test runs for performance
- Supports both basic users and company admin users

### Property Form Tests
- **Complete Flow**: Tests the entire 4-step property creation process
- **Data Validation**: Ensures geocoding works and forms validate properly
- **Success Verification**: Confirms properties are created and success messages appear
- **Multiple Scenarios**: Tests different property types (apartment, house, commercial)

### Bookings & Receipts Tests
- **Bookings management**: `e2e/bookings-and-receipts.spec.ts` uses the basic test user to:
  - View bookings grouped into **Pendientes**, **Próximas / Actuales** and **Pasadas** on `BookingsPage`.
  - Accept and reject pending bookings using the real `BookingService.updateBooking` API.
- **Booking receipts**: The same spec navigates to `/dashboard/subscription/billing-history` to:
  - Trigger on-demand receipt generation via `useEnsureReceiptsAndBlock`.
  - Verify that unpaid booking commission receipts are listed in the **Facturación por reservas** card.
  - Pay a receipt using the **Pagar** button (which calls `BookingReceiptService.markReceiptPaid`) and assert it disappears from the unpaid list.

> The booking and receipt data used by these tests is seeded by the migration `20260227100000_add_test_bookings_for_e2e.sql`. Make sure this migration has been applied (e.g. via `supabase db reset`) before running the Playwright suite.

### Test Data
Test data is generated dynamically to avoid conflicts:
- Unique property titles with timestamps
- Realistic property information
- Multiple property type scenarios

## Test Users

| Email | Password | Role | Description |
|-------|----------|------|-------------|
| `test@example.com` | `testpassword123` | Basic User | Can create personal properties |
| `admin@testcompany.com` | `adminpassword123` | Company Admin | Can create company properties |

## Debugging

### View Test Execution
```bash
# Run with browser visible
npx playwright test --headed

# Run specific test with debugging
npx playwright test --debug e2e/add-property-form.spec.ts
```

### Clear Authentication Cache
If tests fail due to stale authentication:
```bash
# Delete cached auth state (will re-login on next run)
rm -rf e2e/.auth/
```

### Test Reports
```bash
# View HTML report
npx playwright show-report

# Generate JUnit report
npx playwright test --reporter=junit
```

## CI/CD Integration

For CI/CD pipelines, ensure:

1. Supabase test database is set up
2. Environment variables are configured
3. Test migrations are run before tests
4. Browser dependencies are installed

Example GitHub Actions:
```yaml
- name: Install Playwright browsers
  run: npx playwright install --with-deps

- name: Run E2E tests
  run: npx playwright test
  env:
    VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```

## Troubleshooting

### Authentication Issues
- Ensure test users exist in database
- Check Supabase configuration
- Clear auth cache: `rm -rf e2e/.auth/`

### Form Interaction Issues
- Forms use Flowbite React components
- Selectors use `name` attributes for inputs
- Wait for geocoding after address changes

### API Issues
- Tests hit real backend APIs
- Ensure backend is running and accessible
- Check network timeouts in `playwright.config.ts`
