import { Alert, Label, Select } from 'flowbite-react';
import type { PlanData } from '../../../models/subscriptions/PlanData';
import { formatAdminPlanOptionLabel } from '../../../models/subscriptions/adminPlanOptionLabel';

interface AdminPlanAssignFieldsProps {
  idPrefix: string;
  plans: PlanData[];
  currentPlan: PlanData | null;
  loading: boolean;
  plansError: string | null;
  selectedPlanId: string;
  onSelectedPlanIdChange: (planId: string) => void;
  submitError?: string | null;
}

export function AdminPlanAssignFields({
  idPrefix,
  plans,
  currentPlan,
  loading,
  plansError,
  selectedPlanId,
  onSelectedPlanIdChange,
  submitError,
}: AdminPlanAssignFieldsProps) {
  const selectId = `${idPrefix}-plan`;
  const currentLabel = loading
    ? '…'
    : plansError
      ? '—'
      : currentPlan
        ? formatAdminPlanOptionLabel(currentPlan)
        : 'Sin plan';

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Plan actual</p>
        <p className="text-gray-900 dark:text-white">{currentLabel}</p>
      </div>

      {plansError ? (
        <Alert color="failure">{plansError}</Alert>
      ) : null}

      {!loading && !plansError && plans.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-300">No hay planes disponibles</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Cargando planes…</p>
      ) : null}

      {!loading && !plansError && plans.length > 0 ? (
        <div>
          <Label htmlFor={selectId} className="mb-2 block">Plan</Label>
          <Select
            id={selectId}
            value={selectedPlanId}
            onChange={(event) => onSelectedPlanIdChange(event.target.value)}
          >
            <option value="">Seleccionar plan</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {formatAdminPlanOptionLabel(plan)}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      {submitError ? <Alert color="failure">{submitError}</Alert> : null}
    </div>
  );
}
