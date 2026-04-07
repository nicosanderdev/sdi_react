import { supabase } from '../config/supabase';

export type PaymentFilterStatus = 'all' | 'paid' | 'unpaid';
export type ReceiptFilterStatus = 'all' | 'paid' | 'unpaid';

export interface AdminPaymentBookingRow {
  id: string;
  userName: string;
  userEmail: string;
  userIdentifier: string;
  propertyName: string;
  checkInDate: string;
  checkOutDate: string;
  totalAmount: number;
  currency: number;
  paymentStatus: number;
}

export interface AdminReceiptItemRow {
  id: string;
  bookingId: string;
  amount: number;
  bookingCheckInDate: string;
  bookingCheckOutDate: string;
}

export interface AdminReceiptRow {
  id: string;
  userName: string;
  userEmail: string;
  amount: number;
  currency: string;
  itemCount: number;
  created: string;
  dueDate: string;
  status: number;
  paidAt: string | null;
  items: AdminReceiptItemRow[];
}

export interface BookingFiltersInput {
  userSearch: string;
  paymentStatus: PaymentFilterStatus;
  fromDate: string;
  toDate: string;
}

export interface ReceiptFiltersInput {
  ownerName: string;
  ownerEmail: string;
  dueDateFrom: string;
  dueDateTo: string;
  status: ReceiptFilterStatus;
}

function mapCurrencyCode(currency: number): string {
  switch (currency) {
    case 1:
      return 'UYU';
    case 2:
      return 'BRL';
    case 3:
      return 'EUR';
    case 4:
      return 'GBP';
    case 0:
    default:
      return 'USD';
  }
}

class PaymentsAdminService {
  async getBookings(filters: BookingFiltersInput): Promise<AdminPaymentBookingRow[]> {
    const userSearch = filters.userSearch.trim() || null;
    const paymentStatus =
      filters.paymentStatus === 'paid'
        ? 1
        : filters.paymentStatus === 'unpaid'
        ? 0
        : null;

    const { data, error } = await supabase.rpc('admin_get_billable_usage', {
      p_user_search: userSearch,
      p_payment_status: paymentStatus,
      p_from_date: filters.fromDate || null,
      p_to_date: filters.toDate || null
    });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row: any) => {
      return {
        id: row.id,
        userName: row.user_name ?? 'Sin propietario',
        userEmail: row.user_email ?? '',
        userIdentifier: row.user_identifier ?? '',
        propertyName: row.property_name ?? 'Sin propiedad',
        checkInDate: row.check_in_date ?? '',
        checkOutDate: row.check_out_date ?? '',
        totalAmount: Number(row.total_amount ?? 0),
        currency: Number(row.currency ?? 0),
        paymentStatus: Number(row.payment_status ?? 0)
      };
    });
  }

  async getReceipts(filters?: Partial<ReceiptFiltersInput>): Promise<AdminReceiptRow[]> {
    const statusFilter = filters?.status ?? 'all';
    const p_status = statusFilter === 'paid' ? 1 : statusFilter === 'unpaid' ? 0 : null;
    const p_owner_name = filters?.ownerName?.trim() || null;
    const p_owner_email = filters?.ownerEmail?.trim() || null;
    const p_due_date_from = filters?.dueDateFrom?.trim() || null;
    const p_due_date_to = filters?.dueDateTo?.trim() || null;

    const { data, error } = await supabase.rpc('admin_get_invoices', {
      p_owner_name,
      p_owner_email,
      p_due_date_from,
      p_due_date_to,
      p_status
    });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row: any) => {
      const items: AdminReceiptItemRow[] = (row.items ?? []).map((item: any) => ({
        id: item.id,
        bookingId: item.bookingId,
        amount: Number(item.amount ?? 0),
        bookingCheckInDate: item.bookingCheckInDate ?? '',
        bookingCheckOutDate: item.bookingCheckOutDate ?? ''
      }));

      return {
        id: row.id,
        userName: row.user_name ?? 'Sin propietario',
        userEmail: row.user_email ?? '',
        amount: Number(row.amount ?? 0),
        currency: row.currency ?? mapCurrencyCode(0),
        itemCount: Number(row.item_count ?? items.length),
        created: row.created,
        dueDate: row.due_date,
        status: Number(row.status ?? 0),
        paidAt: row.paid_at ?? null,
        items
      };
    });
  }

  async generateReceipt(bookingIds: string[]): Promise<string> {
    const { data, error } = await supabase.rpc('admin_generate_invoice_from_usage', {
      p_usage_record_ids: bookingIds
    });

    if (error) {
      throw new Error(error.message);
    }

    return data as string;
  }

  async updateReceiptStatus(receiptId: string, isPaid: boolean): Promise<void> {
    const { error } = await supabase.rpc('admin_set_invoice_status', {
      p_invoice_id: receiptId,
      p_is_paid: isPaid
    });

    if (error) {
      throw new Error(error.message);
    }
  }
}

const paymentsAdminService = new PaymentsAdminService();
export default paymentsAdminService;
