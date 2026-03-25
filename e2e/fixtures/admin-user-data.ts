/** Password long enough for AdminCreateMemberForm validation (min 6). */
export const E2E_NEW_USER_PASSWORD = 'TestPass123!';

/**
 * Unique email per call so parallel / repeated runs avoid collisions.
 * Rows may remain in the dev DB after tests (see spec comment).
 */
export function uniqueTestEmail(): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `e2e-user-${Date.now()}-${suffix}@example.com`;
}
