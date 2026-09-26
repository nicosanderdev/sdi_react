import type { PlanData } from './PlanData';
import { getPropertyTypeShortLabelEs } from '../properties/propertyTypeLabels';

/** Admin assign dropdown: name, price, currency, property type, inactive mark. */
export function formatAdminPlanOptionLabel(plan: PlanData): string {
  const amount = Number.isFinite(plan.monthlyPrice) ? String(plan.monthlyPrice) : '0';
  const currency = plan.currency?.trim() ?? '';
  let label = `${plan.name} — ${amount} ${currency}`.trim();
  if (plan.propertyType) {
    const typeLabel = getPropertyTypeShortLabelEs(plan.propertyType);
    if (typeLabel) label += ` — ${typeLabel}`;
  }
  if (!plan.isActive) label += ' (inactivo)';
  return label;
}

/** Name, then currency, then price. */
export function compareAdminPlans(a: PlanData, b: PlanData): number {
  const byName = a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
  if (byName !== 0) return byName;
  const byCurrency = (a.currency || '').localeCompare(b.currency || '', 'es');
  if (byCurrency !== 0) return byCurrency;
  return a.monthlyPrice - b.monthlyPrice;
}
