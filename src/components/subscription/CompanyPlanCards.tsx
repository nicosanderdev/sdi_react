import { CheckCircle } from 'lucide-react';
import type { PlanData } from '../../models/subscriptions/PlanData';
import { formatPlanLimit } from '../../models/subscriptions/PlanData';

function formatMoney(plan: PlanData): string {
  const amount = Number(plan.monthlyPrice ?? 0);
  const currency = plan.currency || 'UYU';
  return `${amount} ${currency}`;
}

export function CompanyPlanCards({
  plans,
  selectedPlanId,
  onSelect,
  disabled,
}: {
  plans: PlanData[];
  selectedPlanId: string | null;
  onSelect: (planId: string) => void;
  disabled?: boolean;
}) {
  if (plans.length === 0) {
    return <p className="text-sm text-gray-600">No hay planes de empresa activos.</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {plans.map((plan) => {
        const selected = selectedPlanId === plan.id;
        return (
          <button
            key={plan.id}
            type="button"
            data-testid={`company-plan-option-${plan.id}`}
            disabled={disabled}
            onClick={() => onSelect(plan.id)}
            className={`text-left rounded-xl border-2 p-4 transition-all ${
              selected
                ? 'ring-2 ring-purple-600 border-purple-600 shadow-lg'
                : 'border-gray-200 dark:border-gray-700 hover:shadow-md'
            }`}
          >
            <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
            <p className="text-2xl font-semibold mb-3">
              {formatMoney(plan)}
              <span className="text-sm font-normal text-gray-600"> / ciclo</span>
            </p>
            <ul className="space-y-1 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                {formatPlanLimit(plan.totalProperties)} propiedades
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                {formatPlanLimit(plan.maxUsers)} usuarios
              </li>
            </ul>
          </button>
        );
      })}
    </div>
  );
}
