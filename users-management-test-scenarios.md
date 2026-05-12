# Users Management Manual Test Scenarios

Status: Manual QA matrix for admin Users Management  
Scope: Dashboard metrics, search, view/edit/reset/force logout/delete, create user

## Preconditions

- At least one admin account and two non-admin test users.
- Test dataset includes:
  - active and soft-deleted users
  - users with/without subscriptions
  - users with/without properties
  - at least one suspended/banned auth account
- Ability to inspect Supabase `auth.users` and `Members` records (read-only).
- Two browser sessions/devices for force-logout testing.

## 1) Dashboard Metrics

### TC-DM-01: KPI totals match DB counts
- Steps:
  1. Open admin dashboard.
  2. Capture displayed total users/properties/active users values.
  3. Compare with DB counts using the same definitions.
- Expected:
  - Counts match documented definitions.
  - No unexplained discrepancies.

### TC-DM-02: New users/properties window boundaries
- Steps:
  1. Create records near UTC boundary (`23:59` and `00:01`).
  2. Refresh dashboard for 7d and 30d windows.
- Expected:
  - Boundary records are counted correctly per window.

### TC-DM-03: Soft-deleted user effect
- Steps:
  1. Soft-delete a user.
  2. Refresh dashboard and users list.
- Expected:
  - Behavior is consistent with product policy (excluded or shown as deleted) across all screens.

### TC-DM-04: RPC fallback behavior
- Steps:
  1. Simulate dashboard RPC failure (staging toggle or temporary failure).
  2. Confirm fallback path renders values.
- Expected:
  - UI remains usable.
  - Error/partial data state is explicit.

## 2) User Search

### TC-US-01: Search by name/email partial text
- Steps:
  1. Search by first name fragment.
  2. Search by last name fragment.
  3. Search by email fragment.
- Expected:
  - Relevant users returned, unrelated users excluded.

### TC-US-02: Case/accent handling
- Steps:
  1. Search using uppercase/lowercase variants.
  2. Search with and without accents for accented names.
- Expected:
  - Results remain consistent and intuitive.

### TC-US-03: Rapid typing stability
- Steps:
  1. Type quickly into search field.
  2. Observe loading/results transitions.
- Expected:
  - Final results correspond to last typed value.
  - No stale-result overwrite.

### TC-US-04: Combined filters + pagination
- Steps:
  1. Apply subscription, account status, and date filters.
  2. Move between pages.
- Expected:
  - Filter scope remains stable across pages.
  - Totals and row sets are consistent.

## 3) User Table & Actions

### TC-UA-01: View user data parity (Auth vs Members)
- Steps:
  1. Open user row and click `Ver`.
  2. Compare modal fields against `Members` and `auth.users`.
- Expected:
  - Displayed values match source-of-truth mapping.

### TC-UA-02: Edit user happy path
- Steps:
  1. Edit first name, last name, email, phone.
  2. Save.
  3. Re-open user detail and verify DB rows.
- Expected:
  - Update persists correctly.
  - `Members` and `auth.users` are synchronized.

### TC-UA-03: Edit validation errors
- Steps:
  1. Submit invalid email format.
  2. Submit duplicate email/phone.
- Expected:
  - Proper field-level errors shown.
  - No partial silent updates.

### TC-UA-04: Edit partial failure handling
- Steps:
  1. Simulate auth sync failure after member update (staging fault injection).
  2. Save edit.
- Expected:
  - Explicit partial-failure message appears.
  - Reconciliation guidance logged/visible.

### TC-UA-05: Reset onboarding behavior
- Steps:
  1. Select user with onboarding progressed.
  2. Trigger `Reiniciar onboarding`.
  3. Re-login as target user and verify onboarding flow.
- Expected:
  - Control fields reset as designed.
  - No unrelated profile/subscription fields changed.

### TC-UA-06: Force logout cross-device
- Steps:
  1. Keep target user active in two devices/tabs.
  2. Admin triggers force logout.
  3. Observe both sessions.
- Expected:
  - Both sessions are invalidated within defined SLA.
  - User cannot continue privileged actions after invalidation.

### TC-UA-07: Soft delete + auth ban coherence
- Steps:
  1. Delete user via admin action.
  2. Verify `Members.IsDeleted = true`.
  3. Verify auth account is banned/blocked.
- Expected:
  - User is inaccessible.
  - If ban fails, explicit warning appears and is traceable.

### TC-UA-08: Non-admin cannot execute admin actions
- Steps:
  1. Call action endpoints/RPCs with non-admin token.
- Expected:
  - Operations denied (`Forbidden`).

## 4) Create User (Critical)

### TC-CU-01: Happy path creates both Auth + Member
- Steps:
  1. Admin creates user with valid required fields.
  2. Inspect `auth.users` and `Members`.
- Expected:
  - Both records exist and are linked by `Members.UserId = auth.users.id`.
  - UI shows success.

### TC-CU-02: Duplicate email
- Steps:
  1. Attempt create with existing email.
- Expected:
  - Clear duplicate error.
  - No new `Members` row.

### TC-CU-03: Duplicate phone (if unique policy enforced)
- Steps:
  1. Attempt create with existing phone.
- Expected:
  - Clear duplicate error.
  - No orphan auth user.

### TC-CU-04: Member write failure after auth create
- Steps:
  1. Simulate member insert/update failure.
  2. Trigger create user.
- Expected:
  - Rollback attempts auth deletion.
  - No orphan auth user remains.
  - Failure is explicit and auditable.

### TC-CU-05: Rollback failure path
- Steps:
  1. Simulate failure in auth delete compensation.
- Expected:
  - Error code indicates rollback failure.
  - Event is logged for reconciliation.

### TC-CU-06: Weak password / required fields
- Steps:
  1. Submit missing required fields.
  2. Submit password below minimum.
- Expected:
  - Validation blocks request before persistence.

## 5) Sorting and Filter Contract

### TC-SF-01: Sort by each sortable column
- Steps:
  1. Click each sortable header twice.
  2. Compare row order with expected asc/desc.
- Expected:
  - Sort indicator and row order are consistent.

### TC-SF-02: Subscription tier filter mapping
- Steps:
  1. For each tier option, apply filter.
  2. Validate returned users truly belong to selected plan.
- Expected:
  - No cross-tier leakage or empty false negatives caused by mapping mismatch.

## 6) Regression and Security

### TC-RS-01: Route-level and API-level admin protections
- Steps:
  1. Attempt admin URLs and RPCs as non-admin.
- Expected:
  - UI and backend both deny access.

### TC-RS-02: Session replay and stale token behavior
- Steps:
  1. Attempt actions after logout/force logout with stale session.
- Expected:
  - Requests fail authorization.

### TC-RS-03: Data integrity sweep after batch operations
- Steps:
  1. Run series: create, edit, reset onboarding, force logout, delete.
  2. Inspect `auth.users` and `Members`.
- Expected:
  - No orphan or duplicate linkage.
  - Action outcomes are internally consistent.
