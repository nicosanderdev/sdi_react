# Users Management Code Remediation Proposal

Status: Proposal only (no code applied in this document)  
Target: Admin users management reliability, integrity, and security

## Objectives

1. Prevent Auth/Member divergence in create/edit flows.
2. Make admin actions deterministic and observable.
3. Ensure metrics/search/table behavior matches UI expectations.

## Proposed Changes by File

## `supabase/functions/create-member/index.ts`

- Add rollback failure handling:
  - Capture the result of `auth.admin.deleteUser(userId)`.
  - If rollback fails, return `AUTH_ROLLBACK_FAILED` with a clear message and correlation ID.
- Add structured logging:
  - Include `requestId`, `adminUserId`, `targetEmail`, and step (`create_auth`, `upsert_member`, `rollback_auth`).
- Tighten duplicate checks:
  - Optional pre-check on normalized email/phone to fail fast before auth create.
  - Keep DB unique constraints as source of truth.

## `supabase/functions/admin-update-user/index.ts`

- Standardize dual-write outcomes:
  - Return explicit `partial_failure` code when member update succeeds but auth sync fails.
  - Include `memberId` + `userId` in error payload for support reconciliation.
- Add optional retry policy for transient auth sync errors (bounded, short backoff).
- Emit structured audit event records for sensitive admin changes.

## `src/services/UserAdminService.tsx`

- Align filter contract:
  - Replace numeric `SubscriptionTier` transport with canonical plan keys or enforce mapping both ways.
- Normalize `ActionResult` parsing:
  - Some RPCs return JSON objects; normalize shape with runtime guards before UI use.
- Add typed errors:
  - Surface machine-readable error codes (`EMAIL_EXISTS`, `PHONE_EXISTS`, `AUTH_ROLLBACK_FAILED`) to UI.

## `src/hooks/useAdminUsers.ts`

- Add request race protection:
  - Track `requestId` for `fetchUsers`; ignore stale responses.
- Wire sort behavior:
  - Either pass `sort_field`/`sort_direction` into RPC params or do deterministic local sort when page data is small.
- Improve action UX:
  - Preserve action-level success/failure details after modals close for post-action visibility.

## `src/components/admin/users/UserFilters.tsx`

- Add debounce (250-400ms) for search input.
- Cancel stale requests via hook-level guard.
- Keep immediate form feedback but avoid one request per keystroke.

## `src/components/admin/users/UserManagementTable.tsx`

- If backend sort exists:
  - Keep sortable headers and display active sort indicator.
- If backend sort does not exist yet:
  - Hide sort affordances to avoid false expectations.

## `src/components/admin/users/UserStatistics.tsx`

- Resolve scope mismatch:
  - Option A: fetch global stats from dedicated RPC and keep card labels global.
  - Option B: explicitly label all cards as current-page stats and group separately from global totals.

## `src/services/AdminService.tsx`

- Standardize metric definitions:
  - Ensure KPI and trend use same semantic source per metric.
  - Add comment-level contracts for each metric definition.
- Add data freshness metadata:
  - Include `asOf` timestamp in service response for dashboard transparency.

## `src/contexts/AuthContext.tsx`

- Force logout hardening:
  - Check force-logout flag more frequently on active sessions and on token refresh events.
  - On force logout, clear local state before alerting to avoid stale UI.
- Optional enhancement:
  - Subscribe to lightweight server events if available instead of relying on 5-minute polling.

## Cross-Cutting Recommendations

- Introduce audit logging helper for admin actions (`suspend`, `reactivate`, `role_change`, `force_logout`, `delete`).
- Define shared `AdminApiError` shape across edge functions and frontend services.
- Add integration tests around partial failures and rollback outcomes.

## Suggested Implementation Order

1. Integrity and rollback/error code hardening in edge functions.
2. Filter/sort contract alignment between frontend and RPC.
3. Metrics definition consistency updates.
4. UX reliability improvements (debounce, stale request handling, scope labeling).
