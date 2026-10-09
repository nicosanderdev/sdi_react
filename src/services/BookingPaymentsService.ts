import { supabase } from '../config/supabase';
import type { CancellationPolicy } from './CancellationPolicyService';

export type CancellationInitiator = 'guest' | 'host' | 'admin' | 'system';

export interface CancellationPreview {
  success: true;
  bookingId: string;
  initiator: CancellationInitiator;
  canCancel: boolean;
  policyTier: string;
  amountPaid: number;
  refundPercent: number;
  refundAmount: number;
  refundDueAt: string | null;
  policySnapshot: CancellationPolicy;
  previewHash: string;
  message?: string | null;
}

export interface BookingPaymentRow {
  Id: string;
  BookingId: string;
  EntryType: 'payment' | 'refund' | 'reversal';
  Amount: number;
  Currency: number;
  Source: string;
  Method: string | null;
  RecordedBy: string;
  Note: string | null;
  MpPaymentId: string | null;
  Created: string;
}

function mapPreview(data: Record<string, unknown>): CancellationPreview {
  return {
    success: true,
    bookingId: String(data.bookingId),
    initiator: data.initiator as CancellationInitiator,
    canCancel: Boolean(data.canCancel),
    policyTier: String(data.policyTier ?? 'n/a'),
    amountPaid: Number(data.amountPaid ?? 0),
    refundPercent: Number(data.refundPercent ?? 0),
    refundAmount: Number(data.refundAmount ?? 0),
    refundDueAt: (data.refundDueAt as string) ?? null,
    policySnapshot: data.policySnapshot as CancellationPolicy,
    previewHash: String(data.previewHash),
    message: (data.message as string) ?? null,
  };
}

export class BookingPaymentsService {
  static async previewCancellation(
    bookingId: string,
    initiator: 'host' | 'admin' = 'host'
  ): Promise<CancellationPreview> {
    const { data, error } = await supabase.rpc('preview_booking_cancellation', {
      p_booking_id: bookingId,
      p_initiator: initiator,
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || data?.message || 'No se pudo previsualizar');
    return mapPreview(data);
  }

  static async cancelAsHost(
    bookingId: string,
    reason: string,
    previewHash?: string
  ): Promise<{ success: boolean; preview?: CancellationPreview }> {
    const { data, error } = await supabase.rpc('cancel_booking_as_host', {
      p_booking_id: bookingId,
      p_reason: reason,
      p_preview_hash: previewHash ?? null,
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || 'No se pudo cancelar');
    return {
      success: true,
      preview: data.preview ? mapPreview(data.preview) : undefined,
    };
  }

  static async recordPayment(params: {
    bookingId: string;
    amount: number;
    method?: string;
    note?: string;
    source?: 'owner' | 'admin';
  }): Promise<void> {
    const { data, error } = await supabase.rpc('record_booking_payment', {
      p_booking_id: params.bookingId,
      p_amount: params.amount,
      p_source: params.source ?? 'owner',
      p_method: params.method ?? 'other',
      p_note: params.note ?? null,
      p_mp_payment_id: null,
      p_mp_attempt_id: null,
      p_recorded_by: null,
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || 'No se pudo registrar el pago');
  }

  static async recordRefund(params: {
    bookingId: string;
    amount: number;
    method?: string;
    note?: string;
    source?: 'owner' | 'admin';
  }): Promise<void> {
    const { data, error } = await supabase.rpc('record_booking_refund', {
      p_booking_id: params.bookingId,
      p_amount: params.amount,
      p_source: params.source ?? 'owner',
      p_method: params.method ?? 'other',
      p_note: params.note ?? null,
      p_mp_payment_id: null,
      p_recorded_by: null,
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || 'No se pudo registrar el reembolso');
  }

  static async listPayments(bookingId: string): Promise<BookingPaymentRow[]> {
    const { data, error } = await supabase
      .from('BookingPayments')
      .select('*')
      .eq('BookingId', bookingId)
      .order('Created', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as BookingPaymentRow[];
  }

  static async adminListRefunds(params?: {
    ownerSearch?: string;
    refundStatus?: number | null;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Record<string, unknown>[]; total: number }> {
    const { data, error } = await supabase.rpc('admin_list_booking_refunds', {
      p_owner_search: params?.ownerSearch ?? null,
      p_refund_status: params?.refundStatus ?? null,
      p_limit: params?.limit ?? 50,
      p_offset: params?.offset ?? 0,
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || 'No se pudo cargar');
    return {
      items: (data.items as Record<string, unknown>[]) ?? [],
      total: Number(data.total ?? 0),
    };
  }
}

export default BookingPaymentsService;
