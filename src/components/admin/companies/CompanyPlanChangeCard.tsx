import { useState } from 'react';
import { Button, Card } from 'flowbite-react';
import { AdminPlanAssignFields } from '../plans/AdminPlanAssignFields';
import { useAdminAssignablePlans } from '../../../hooks/useAdminAssignablePlans';
import subscriptionService from '../../../services/SubscriptionService';

interface CompanyPlanChangeCardProps {
  companyId: string;
  companyName: string;
}

export function CompanyPlanChangeCard({ companyId, companyName }: CompanyPlanChangeCardProps) {
  const {
    plans,
    currentPlan,
    loading,
    error,
    selectedPlanId,
    setSelectedPlanId,
    canSubmit,
    reload,
  } = useAdminAssignablePlans('company', companyId);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await subscriptionService.changeCompanyPlan(companyId, selectedPlanId);
      await reload({ quiet: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo cambiar el plan.';
      setSubmitError(message || 'No se pudo cambiar el plan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card data-testid="admin-company-change-plan">
      <h3 className="mb-4 text-lg font-semibold">Cambiar plan de {companyName}</h3>
      <AdminPlanAssignFields
        idPrefix="admin-change-company-plan"
        plans={plans}
        currentPlan={currentPlan}
        loading={loading}
        plansError={error}
        selectedPlanId={selectedPlanId}
        onSelectedPlanIdChange={(planId) => {
          setSubmitError(null);
          setSelectedPlanId(planId);
        }}
        submitError={submitError}
      />
      <div className="mt-4 flex justify-end">
        <Button
          onClick={() => void handleConfirm()}
          disabled={!canSubmit || submitting}
          data-testid="admin-change-company-plan-confirm"
        >
          {submitting ? 'Cambiando…' : 'Cambiar plan'}
        </Button>
      </div>
    </Card>
  );
}
