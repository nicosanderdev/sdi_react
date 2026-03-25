import { BrowserContext, Page } from '@playwright/test';

/**
 * Authentication utilities for Playwright tests
 *
 * This file provides helpers for handling authentication in tests.
 * You should customize the login process according to your authentication system.
 */

// Test user credentials - use environment variables when available
export const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'testpassword123',
};

// Alternative test users for different scenarios
export const TEST_USERS = {
  basic: {
    email: process.env.TEST_USER_EMAIL || 'test@example.com',
    password: process.env.TEST_USER_PASSWORD || 'testpassword123',
  },
  admin: {
    email: process.env.ADMIN_USER_EMAIL || 'admin@testcompany.com',
    password: process.env.ADMIN_USER_PASSWORD || 'adminpassword123',
  },
};

/**
 * Log in as the seeded admin without writing storage state (safe for parallel workers).
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  const user = TEST_USERS.admin;
  await page.goto('/login', { waitUntil: 'load' });
  await page.waitForSelector('form', { timeout: 10000 });
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await page.click('button[type="submit"]:has-text("Iniciar Sesión")');
  await page.waitForURL('**/dashboard*', { timeout: 30000 });
}

/**
 * Login to the application and save authentication state
 * Customize this function based on your authentication flow
 */
export async function loginAndSaveState(page: Page, context: BrowserContext, userType: 'basic' | 'admin' = 'basic'): Promise<void> {
  const user = TEST_USERS[userType];

  console.log(`🔐 Starting login process for ${userType} user: ${user.email}`);

  // Navigate to login page
  console.log('📍 Navigating to /login');
  await page.goto('/login', { waitUntil: 'load' });
  console.log(`📍 Current URL after navigation: ${page.url()}`);

  // Wait for login form to be visible - using the actual form structure
  console.log('⏳ Waiting for login form to be visible');
  await page.waitForSelector('form', { timeout: 10000 });
  console.log('✅ Login form found');

  // Fill login credentials using the correct input names from the form
  console.log(`✍️ Filling credentials for ${user.email}`);
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);

  // Click login button
  console.log('🖱️ Clicking login button');
  await page.click('button[type="submit"]:has-text("Iniciar Sesión")');

  // Wait for successful login - check for dashboard navigation
  console.log('⏳ Waiting for dashboard navigation after login');
  await page.waitForURL('**/dashboard*', { timeout: 30000 });
  console.log(`✅ Successfully logged in, current URL: ${page.url()}`);

  // Save authentication state for future tests
  console.log(`💾 Saving authentication state to e2e/.auth/${userType}-user.json`);
  await context.storageState({ path: `e2e/.auth/${userType}-user.json` });
  console.log('✅ Authentication state saved successfully');
}

/**
 * Setup authenticated context for tests
 * Call this in your test setup to ensure user is logged in
 */
export async function setupAuthenticatedContext(context: BrowserContext, userType: 'basic' | 'admin' = 'basic'): Promise<Page> {
  const authFile = `e2e/.auth/${userType}-user.json`;

  // Check if auth state file exists
  const fs = await import('fs');
  const path = await import('path');
  const authFilePath = path.join(process.cwd(), authFile);

  let page: Page;

  if (fs.existsSync(authFilePath)) {
    console.log(`🔍 Found saved auth state for ${userType} user at ${authFile}, attempting to use it...`);

    try {
      // Create context with saved storage state
      console.log('📂 Loading authentication state from file...');
      const authState = JSON.parse(fs.readFileSync(authFilePath, 'utf8'));
      console.log(`📊 Loaded auth state with ${authState.cookies?.length || 0} cookies`);

      await context.addCookies(authState.cookies);

      console.log('🗄️ Setting up localStorage and sessionStorage...');
      await context.addInitScript((storage) => {
        for (const [key, value] of Object.entries(storage.localStorage || {})) {
          localStorage.setItem(key, value);
        }
        for (const [key, value] of Object.entries(storage.sessionStorage || {})) {
          sessionStorage.setItem(key, value);
        }
      }, authState.origins);

      page = await context.newPage();
      console.log('📄 New page created with auth state');

      // Test if auth state is still valid by navigating to dashboard
      console.log('🧪 Testing auth state validity by navigating to /dashboard');
      await page.goto('/dashboard', { waitUntil: 'load' });
      console.log(`📍 Navigation completed, current URL: ${page.url()}`);

      // Check if we were redirected to login (auth state expired)
      const currentUrl = page.url();
      const loginRequired = currentUrl.includes('/login') || await page.locator('input[name="email"]').isVisible({ timeout: 2000 }).catch(() => false);

      if (!loginRequired) {
        console.log(`✅ Authentication state still valid for ${userType} user, proceeding with test...`);
        return page;
      } else {
        console.log(`⏰ Authentication state expired for ${userType} user, need to login again...`);
      }
    } catch (error) {
      console.log(`❌ Failed to load auth state for ${userType} user: ${error.message}, will login manually`);
    }
  } else {
    console.log(`📭 No saved auth state found for ${userType} user, will perform fresh login`);
  }

  // If we reach here, we need to perform fresh login
  page = await context.newPage();
  await loginAndSaveState(page, context, userType);

  return page;
}

/**
 * Check if user is authenticated by navigating to a protected route
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  // Navigate to dashboard (protected route)
  await page.goto('/dashboard');

  // Check for dashboard content - customize based on your app
  const dashboardVisible = await page.locator('[data-testid="dashboard-content"]').isVisible();

  // Alternative: check if redirected to login
  const loginVisible = await page.locator('[data-testid="login-form"]').isVisible();

  return dashboardVisible && !loginVisible;
}

/**
 * Logout from the application
 */
export async function logout(page: Page): Promise<void> {
  // Click logout button - customize selector based on your app
  await page.click('[data-testid="logout-button"]');

  // Wait for logout completion
  await page.waitForURL('**/login**', { timeout: 10000 });
}

/**
 * Clear saved authentication state
 */
export async function clearAuthState(userType?: 'basic' | 'admin'): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  try {
    const authPaths = userType
      ? [`e2e/.auth/${userType}-user.json`]
      : ['e2e/.auth/basic-user.json', 'e2e/.auth/admin-user.json', 'e2e/.auth/user.json'];

    for (const authPath of authPaths) {
      const fullPath = path.join(process.cwd(), authPath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`Authentication state cleared for ${authPath}`);
      }
    }
  } catch (error) {
    console.log('No authentication state to clear');
  }
}
