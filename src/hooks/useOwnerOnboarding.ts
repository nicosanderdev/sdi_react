import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { selectUserProfile } from '../store/slices/userSlice';
import * as ownerOnboardingService from '../services/OwnerOnboardingService';
import type { OwnerOnboardingState } from '../services/OwnerOnboardingService';

/** Plan key 0 = FREE in DB */
const PLAN_KEY_FREE = 0;

/** Session-only step persistence: DB only has "NeedsOnboarding" + verification timestamps. */
const midStepKey = (memberId: string) => `ownerOnboarding.midStep.${memberId}`;
const postStepKey = (memberId: string) => `ownerOnboarding.postStep.${memberId}`;

function mergeSessionSteps(memberId: string, server: OwnerOnboardingState): OwnerOnboardingState {
  if (typeof window === 'undefined') return server;

  if (!server.completedAt) {
    sessionStorage.removeItem(postStepKey(memberId));
    const mid = sessionStorage.getItem(midStepKey(memberId));
    if (mid != null) {
      const m = parseInt(mid, 10);
      if (!Number.isNaN(m) && m >= 0 && m <= 4) {
        return { ...server, currentStep: Math.max(server.currentStep, m) };
      }
    }
    return server;
  }

  sessionStorage.removeItem(midStepKey(memberId));
  const ps = sessionStorage.getItem(postStepKey(memberId));
  if (ps != null) {
    const p = parseInt(ps, 10);
    if (!Number.isNaN(p) && p >= 5) {
      return { ...server, currentStep: Math.max(server.currentStep, p) };
    }
  }
  return server;
}

export interface UseOwnerOnboardingResult {
  /** Current onboarding step (0 = not started, 1 = welcome, 2 = verification, 3 = plan limit, 4 = form, 5 = completed, 6+ = post tips) */
  currentStep: number;
  completedAt: string | null;
  dismissedAt: string | null;
  publishedPropertiesCount: number;
  emailVerified: boolean;
  phoneVerified: boolean;
  planPublishedLimit: number;
  isFreePlan: boolean;
  /** User has no published properties yet and has not dismissed/completed onboarding */
  isEligibleForOnboarding: boolean;
  /** User already has at least one published property → skip main onboarding */
  isExperiencedOwner: boolean;
  isLoading: boolean;
  error: string | null;
  setStep: (step: number) => Promise<boolean>;
  dismiss: () => Promise<boolean>;
  complete: () => Promise<boolean>;
  refetch: () => Promise<void>;
  memberId: string | null;
}

export function useOwnerOnboarding(): UseOwnerOnboardingResult {
  const profile = useSelector((state: RootState) => selectUserProfile(state));
  const memberId = profile?.id ?? null;

  const [state, setState] = useState<OwnerOnboardingState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    if (!memberId) {
      setState(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await ownerOnboardingService.getOwnerOnboardingState(memberId);
      setState(data ? mergeSessionSteps(memberId, data) : null);
    } catch (e: any) {
      console.error('useOwnerOnboarding fetch:', e);
      setError(e?.message ?? 'Failed to load onboarding state');
      setState(null);
    } finally {
      setIsLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const setStep = useCallback(
    async (step: number) => {
      if (!memberId) return false;
      const ok = await ownerOnboardingService.updateOwnerOnboardingStep(memberId, step, false);
      if (ok && typeof window !== 'undefined') {
        if (step >= 0 && step < 5) {
          sessionStorage.setItem(midStepKey(memberId), String(step));
        } else if (step >= 5) {
          sessionStorage.setItem(postStepKey(memberId), String(step));
        }
      }
      if (ok) await fetchState();
      return ok;
    },
    [memberId, fetchState]
  );

  const dismiss = useCallback(async () => {
    if (!memberId) return false;
    const current = state?.currentStep ?? 0;
    const ok = await ownerOnboardingService.updateOwnerOnboardingStep(memberId, current, true);
    if (ok && typeof window !== 'undefined') {
      sessionStorage.removeItem(midStepKey(memberId));
      sessionStorage.removeItem(postStepKey(memberId));
    }
    if (ok) await fetchState();
    return ok;
  }, [memberId, state?.currentStep, fetchState]);

  const complete = useCallback(async () => {
    if (!memberId) return false;
    const ok = await ownerOnboardingService.completeOwnerOnboarding(memberId);
    if (ok && typeof window !== 'undefined') {
      sessionStorage.removeItem(midStepKey(memberId));
    }
    if (ok) await fetchState();
    return ok;
  }, [memberId, fetchState]);

  const isExperiencedOwner = (state?.publishedPropertiesCount ?? 0) >= 1;
  const isDismissed = !!state?.dismissedAt;
  const isCompleted = !!state?.completedAt;
  const isEligibleForOnboarding =
    !isExperiencedOwner && !isDismissed && !isCompleted && !!memberId;
  const isFreePlan = (state?.planKey ?? PLAN_KEY_FREE) === PLAN_KEY_FREE;

  return {
    currentStep: state?.currentStep ?? 0,
    completedAt: state?.completedAt ?? null,
    dismissedAt: state?.dismissedAt ?? null,
    publishedPropertiesCount: state?.publishedPropertiesCount ?? 0,
    emailVerified: state?.emailVerified ?? false,
    phoneVerified: state?.phoneVerified ?? false,
    planPublishedLimit: state?.planPublishedLimit ?? 5,
    isFreePlan,
    isEligibleForOnboarding,
    isExperiencedOwner,
    isLoading,
    error,
    setStep,
    dismiss,
    complete,
    refetch: fetchState,
    memberId,
  };
}
