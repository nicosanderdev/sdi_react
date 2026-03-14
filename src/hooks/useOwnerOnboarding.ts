import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { selectUserProfile } from '../store/slices/userSlice';
import * as ownerOnboardingService from '../services/OwnerOnboardingService';
import type { OwnerOnboardingState } from '../services/OwnerOnboardingService';

/** Plan key 0 = FREE in DB */
const PLAN_KEY_FREE = 0;

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
      setState(data ?? null);
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
      if (ok) await fetchState();
      return ok;
    },
    [memberId, fetchState]
  );

  const dismiss = useCallback(async () => {
    if (!memberId) return false;
    const current = state?.currentStep ?? 0;
    const ok = await ownerOnboardingService.updateOwnerOnboardingStep(memberId, current, true);
    if (ok) await fetchState();
    return ok;
  }, [memberId, state?.currentStep, fetchState]);

  const complete = useCallback(async () => {
    if (!memberId) return false;
    const ok = await ownerOnboardingService.completeOwnerOnboarding(memberId);
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
