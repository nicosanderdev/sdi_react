import { supabase } from '../config/supabase';

export interface CancellationPolicy {
  freeCancellationDays: number;
  refundPercentBefore: number;
  refundPercentAfter: number;
  depositPercent: number;
  balanceDueDays: number | null;
}

export const DEFAULT_CANCELLATION_POLICY: CancellationPolicy = {
  freeCancellationDays: 7,
  refundPercentBefore: 100,
  refundPercentAfter: 0,
  depositPercent: 100,
  balanceDueDays: null,
};

function parsePolicy(raw: unknown): CancellationPolicy {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CANCELLATION_POLICY };
  const o = raw as Record<string, unknown>;
  return {
    freeCancellationDays: Number(o.freeCancellationDays ?? 7),
    refundPercentBefore: Number(o.refundPercentBefore ?? 100),
    refundPercentAfter: Number(o.refundPercentAfter ?? 0),
    depositPercent: Number(o.depositPercent ?? 100),
    balanceDueDays:
      o.balanceDueDays === null || o.balanceDueDays === undefined
        ? null
        : Number(o.balanceDueDays),
  };
}

export class CancellationPolicyService {
  static async getForProperty(propertyId: string): Promise<CancellationPolicy> {
    const { data, error } = await supabase.rpc('get_property_cancellation_policy', {
      p_property_id: propertyId,
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || 'No se pudo cargar la política');
    return parsePolicy(data.policy);
  }

  static async upsertForProperty(
    propertyId: string,
    policy: CancellationPolicy
  ): Promise<CancellationPolicy> {
    const deposit = policy.depositPercent;
    const { data, error } = await supabase.rpc('upsert_property_cancellation_policy', {
      p_property_id: propertyId,
      p_free_cancellation_days: policy.freeCancellationDays,
      p_refund_percent_before: policy.refundPercentBefore,
      p_refund_percent_after: policy.refundPercentAfter,
      p_deposit_percent: deposit,
      p_balance_due_days: deposit < 100 ? policy.balanceDueDays : null,
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || 'No se pudo guardar la política');
    return parsePolicy(data.policy);
  }

  static summarizeEs(policy: CancellationPolicy): string {
    const before =
      policy.refundPercentBefore >= 100
        ? `Cancelación gratuita hasta ${policy.freeCancellationDays} días antes del check-in`
        : `Reembolso del ${policy.refundPercentBefore}% hasta ${policy.freeCancellationDays} días antes del check-in`;
    const after = `Después, reembolso del ${policy.refundPercentAfter}%.`;
    const deposit =
      policy.depositPercent >= 100
        ? 'Pago total por adelantado.'
        : `Seña del ${policy.depositPercent}%; saldo ${policy.balanceDueDays ?? '—'} días antes.`;
    return `${before}. ${after} ${deposit}`;
  }
}

export default CancellationPolicyService;
