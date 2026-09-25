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
    return <p className="text-sm text-gray-600 dark:text-gray-300">No hay planes de empresa activos.</p>;
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
            className={`text-left rounded-xl border-2 p-4 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
              selected
                ? 'border-primary-600 bg-primary-50 text-gray-900 shadow-md ring-2 ring-primary-600 dark:border-primary-400 dark:bg-primary-950/60 dark:text-white'
                : 'border-gray-300 bg-white text-gray-900 shadow-sm hover:border-primary-500 hover:bg-primary-50/60 hover:shadow-md dark:border-gray-400 dark:bg-gray-900 dark:text-white dark:hover:border-primary-400 dark:hover:bg-gray-800'
            }`}
          >
            <h3 className="text-lg font-bold mb-1 text-gray-900 dark:text-white">{plan.name}</h3>
            <p className="text-2xl font-semibold mb-3 text-gray-900 dark:text-white">
              {formatMoney(plan)}
              <span className="text-sm font-normal text-gray-600 dark:text-gray-300"> / ciclo</span>
            </p>
            <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-200">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                {formatPlanLimit(plan.totalProperties)} propiedades
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                {formatPlanLimit(plan.maxUsers)} usuarios
              </li>
            </ul>
          </button>
        );
      })}
    </div>
  );
}
