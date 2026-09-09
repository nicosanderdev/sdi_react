# Users Management Audit Report

Date: 2026-05-06  
Scope: Admin Users Management (dashboard metrics, search, table/actions, create user)  
Method: Static code and SQL audit only (no DB mutation, no runtime fixes applied)

## Executive Summary

The admin users area has good baseline authorization controls, but there are critical consistency gaps between `auth.users` and `Members`, missing versioned SQL contracts for several RPCs currently used by frontend code, and metric/filter mismatches that can lead to inaccurate admin decisions. The most important risk is environment drift: key user-action RPCs are invoked in code but are not defined in tracked migrations.

## What Is Working

- Admin guardrails exist at multiple layers:
  - Route-level protections in admin UI.
  - Admin checks in RPCs (where defined).
  - Admin checks in edge functions (`create-member`, `admin-update-user`, `admin-ban-user`).
- Create user flow includes best-effort compensation:
  - Creates auth user first, then updates/inserts `Members`.
  - Attempts `auth.admin.deleteUser` if member write fails.
- Edit user flow attempts dual-write:
  - `Members` updated through admin RPC.
  - `auth.users` synchronized using service role.

## Findings by Severity

### Critical

1. Missing SQL definitions for RPCs used by user management actions (environment drift risk)
   - Evidence: frontend calls these RPCs in `src/services/UserAdminService.tsx`:
     - `get_admin_user_detail`
     - `suspend_user`
     - `reactivate_user`
     - `reset_user_onboarding`
     - `force_user_logout`
     - `update_user_role`
     - `soft_delete_user`
     - `check_force_logout`
     - `acknowledge_force_logout`
   - These are not present in tracked `supabase/migrations` files inspected.
   - Risk: fresh environments may break core admin operations or behave differently than production.

2. Auth/Member integrity contract is implicit, not fully versioned in migrations
   - `create-member` assumes a `handle_new_user` trigger exists, then falls back to manual insert if absent (`supabase/functions/create-member/index.ts`).
   - No tracked migration in this repo defines:
     - `Members` table contract
     - `Members.UserId` uniqueness/FK to `auth.users(id)`
     - `handle_new_user` trigger/function
   - Risk: orphan auth users, duplicate/ambiguous member linkage, non-deterministic `.single()` failures.

### High

3. Subscription-tier filter likely mismatched by type/semantics
   - Frontend sends `p_subscription_tier` as numeric enum (`SubscriptionTier` in `src/services/UserAdminService.tsx`).
   - SQL compares `c.plan_key` (`Plans."Key"`) to that integer in `get_admin_users_list` (`supabase/migrations/20260402140000_admin_users_list_and_property_statistics.sql`).
   - Risk: incorrect filtering, empty results, or implicit casts with unpredictable behavior.

4. User totals mismatch risk due to deleted-user handling differences
   - Dashboard totals generally filter `Members.IsDeleted = false` (`src/services/AdminService.tsx`).
   - `get_admin_users_list` computes deleted status but does not exclude deleted users by default.
   - Risk: “total users” across admin screens can disagree.

### Medium

5. Force logout is polling-based on client side; all-device immediacy is uncertain
   - Client checks `check_force_logout` at sign-in/boot and every 5 minutes, then signs out locally (`src/contexts/AuthContext.tsx`).
   - Actual server invalidation semantics depend on missing RPC implementations.
   - Risk: delayed logout enforcement across active sessions/devices.

6. Sort UI appears disconnected from actual data ordering
   - `sortConfig` updates in `useAdminUsers`, but fetch call does not pass sorting params and table does not local-sort.
   - Risk: admins believe sorting is active when results remain default-ordered.

7. Dashboard metric semantics are mixed
   - Different widgets source “properties” from different entities (`EstateProperties` vs `Listings`) depending on metric path.
   - Risk: trend/KPI interpretation inconsistencies.

### Low

8. User statistics cards mix global and page-scoped values
   - `totalUsers` is global, but active/verified/unverified are computed from current page rows in `UserStatistics`.
   - Risk: misleading interpretation without careful reading.

9. Search has no debounce/cancellation
   - Search updates filters on every keystroke (`UserFilters` -> `updateFilters`).
   - Risk: unnecessary load, stale-response flicker under latency.

## Use Case Validation

### 1) Dashboard Metrics

- Data sources identified:
  - RPC: `get_admin_dashboard_stats`, `get_active_users_count`, `get_admin_property_views_summary`
  - Direct table reads fallback: `Members`, `EstateProperties`, `Listings`, `Owners`
- Observed issues:
  - Potential cross-widget definition mismatch.
  - Soft-deleted handling differs from users list path.
  - Placeholder metrics (`pendingApprovals`, `flagsOpen`, `failedJobs`) are static zero.

### 2) User Search

- Search pipeline is straightforward and functional in code path:
  - UI input -> hook filters -> RPC query.
- Reliability concerns:
  - no debounce/cancellation.
  - subscription tier mismatch can skew filtered results.

### 3) User Table & Actions

- View User:
  - Depends on `get_admin_user_detail` RPC (not versioned in migrations found).
- Edit User:
  - Good dual-write intent.
  - Partial failure can leave auth and member data divergent if auth sync fails.
- Reset Onboarding:
  - Invokes `reset_user_onboarding` RPC; SQL contract not present in migrations found.
- Force Logout:
  - Invokes `force_user_logout`; enforcement currently relies on client polling and local signout.

### 4) Create User (Critical Flow)

- Sequence in current edge function:
  1. Verify admin caller.
  2. Create auth user.
  3. Reuse trigger-created member row or insert fallback row.
  4. On member write failure, attempt auth delete rollback.
- Strengths:
  - clear auth/admin validation
  - duplicate email handling
  - rollback attempt for member failure
- Gaps:
  - no hard guarantee rollback succeeds
  - trigger/constraint contract not versioned in repo
  - no durable reconciliation queue for partial failures

## Recommended Fix Directions (Proposal Only)

1. Version and enforce auth-member integrity constraints and trigger contracts via migrations.
2. Add/restore missing users-admin RPC migrations consumed by frontend.
3. Align subscription tier filter type between TS and SQL.
4. Decide and codify deleted-user inclusion/exclusion policy consistently across dashboard and user list.
5. Harden force logout with explicit server-side session invalidation semantics plus tighter client enforcement interval/eventing.
6. Wire sorting end-to-end or remove inactive sort affordance.
7. Introduce search debounce + stale request handling.

## Residual Risk If Unaddressed

- Admin actions may fail in clean/staging environments.
- Data divergence between `auth.users` and `Members` can accumulate.
- Security-sensitive actions (force logout) may not meet immediate enforcement expectations.
- Dashboard/user metrics may remain internally inconsistent.
