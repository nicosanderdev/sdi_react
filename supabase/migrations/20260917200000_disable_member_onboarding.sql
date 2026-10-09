-- Temporarily disable member onboarding: treat all members as complete.
-- UI tours/modals are disconnected in the frontend; this keeps DB state consistent
-- for new signups and existing rows until a fuller onboarding rewrite lands.

-- ---------------------------------------------------------------------------
-- Column defaults: new Members start as onboarding-complete
-- ---------------------------------------------------------------------------
alter table public."Members"
  alter column "NeedsOnboarding" set default false,
  alter column "OnboardingComplete" set default true,
  alter column "OnboardingStep" set default 5;

-- ---------------------------------------------------------------------------
-- Backfill existing Members (including soft-deleted for consistency)
-- ---------------------------------------------------------------------------
update public."Members"
set
  "NeedsOnboarding" = false,
  "OnboardingComplete" = true,
  "OnboardingStep" = 5
where
  "NeedsOnboarding" is distinct from false
  or "OnboardingComplete" is distinct from true
  or "OnboardingStep" is distinct from 5;

-- ---------------------------------------------------------------------------
-- Align unused side tables if rows exist
-- ---------------------------------------------------------------------------
update public."MemberOnboarding"
set
  "OnboardingStep" = 5,
  "IsComplete" = true,
  "CompletedAt" = coalesce("CompletedAt", timezone('utc', now())),
  "LastModified" = timezone('utc', now())
where
  "IsComplete" is distinct from true
  or "OnboardingStep" is distinct from 5;

update public."OwnerOnboarding"
set
  "CurrentStep" = 5,
  "CompletedAt" = coalesce("CompletedAt", timezone('utc', now())),
  "LastModified" = timezone('utc', now())
where
  "CompletedAt" is null
  or "CurrentStep" is distinct from 5;
