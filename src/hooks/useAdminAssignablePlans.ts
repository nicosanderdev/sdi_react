import { useCallback, useEffect, useState } from 'react';
import type { PlanData } from '../models/subscriptions/PlanData';
import { compareAdminPlans } from '../models/subscriptions/adminPlanOptionLabel';
import subscriptionService from '../services/SubscriptionService';

export function useAdminAssignablePlans(
  audience: 'member' | 'company',
  subjectId: string | null,
) {
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [currentPlan, setCurrentPlan] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedSubjectId, setLoadedSubjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');

  const reload = useCallback(async (options?: { quiet?: boolean }) => {
    if (!subjectId) {
      setPlans([]);
      setCurrentPlan(null);
      setSelectedPlanId('');
      setError(null);
      setLoading(false);
      setLoadedSubjectId(null);
      return;
    }

    if (!options?.quiet) setLoading(true);
    setError(null);
    try {
      const [planRows, assigned] = await Promise.all([
        subscriptionService.getPlans(audience, { forAdmin: true }),
        subscriptionService.getActiveAssignedPlan(audience, subjectId),
      ]);
      const sorted = [...planRows].sort(compareAdminPlans);
      setPlans(sorted);
      setCurrentPlan(assigned);
      const assignedInList = assigned != null && sorted.some((plan) => plan.id === assigned.id);
      setSelectedPlanId(assignedInList ? assigned.id : '');
    } catch (err: unknown) {
      setPlans([]);
      setCurrentPlan(null);
      setSelectedPlanId('');
      const message = err instanceof Error ? err.message : 'No se pudieron cargar los planes';
      setError(message || 'No se pudieron cargar los planes');
    } finally {
      setLoadedSubjectId(subjectId);
      if (!options?.quiet) setLoading(false);
    }
  }, [audience, subjectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const pendingSubject = Boolean(subjectId) && loadedSubjectId !== subjectId;
  const uiLoading = loading || pendingSubject;
  const currentPlanIdInList = !uiLoading && currentPlan && plans.some((plan) => plan.id === currentPlan.id)
    ? currentPlan.id
    : '';
  const canSubmit = !uiLoading
    && !error
    && plans.length > 0
    && selectedPlanId !== ''
    && selectedPlanId !== currentPlanIdInList;

  return {
    plans,
    currentPlan: uiLoading ? null : currentPlan,
    loading: uiLoading,
    error,
    selectedPlanId,
    setSelectedPlanId,
    canSubmit,
    reload,
  };
}
