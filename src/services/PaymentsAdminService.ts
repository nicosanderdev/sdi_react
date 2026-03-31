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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

interface OwnerPrincipalIds {
  memberIds: string[];
  companyIds: string[];
}

interface OwnerIdentity {
  name: string;
  email: string;
}

async function searchOwnerPrincipalIds(userSearch: string): Promise<OwnerPrincipalIds> {
  const normalized = userSearch.trim();
  if (!normalized) return { memberIds: [], companyIds: [] };

  const likeTerm = `%${normalized}%`;
  const memberIds = new Set<string>();
  const companyIds = new Set<string>();

  const { data: byText, error: textError } = await supabase
    .from('Members')
    .select('Id')
    .eq('IsDeleted', false)
    .or(
      `FirstName.ilike.${likeTerm},LastName.ilike.${likeTerm},Email.ilike.${likeTerm},Phone.ilike.${likeTerm}`
    )
    .limit(100);

  if (textError) {
    throw new Error(textError.message);
  }

  (byText ?? []).forEach((m) => memberIds.add(m.Id));

  const { data: companiesByText, error: companyTextError } = await supabase
    .from('Companies')
    .select('Id')
    .eq('IsDeleted', false)
    .or(`Name.ilike.${likeTerm},BillingEmail.ilike.${likeTerm}`)
    .limit(100);

  if (companyTextError) {
    throw new Error(companyTextError.message);
  }

  (companiesByText ?? []).forEach((c) => companyIds.add(c.Id));

  if (isUuid(normalized)) {
    const [byIdResult, byUserIdResult, companyByIdResult, companyByContactResult] = await Promise.all([
      supabase
        .from('Members')
        .select('Id')
        .eq('IsDeleted', false)
        .eq('Id', normalized)
        .limit(1),
      supabase
        .from('Members')
        .select('Id')
        .eq('IsDeleted', false)
        .eq('UserId', normalized)
        .limit(1),
      supabase
        .from('Companies')
        .select('Id')
        .eq('IsDeleted', false)
        .eq('Id', normalized)
        .limit(1),
      supabase
        .from('Companies')
        .select('Id')
        .eq('IsDeleted', false)
        .eq('BillingContactUserId', normalized)
        .limit(1)
    ]);

    if (byIdResult.error) throw new Error(byIdResult.error.message);
    if (byUserIdResult.error) throw new Error(byUserIdResult.error.message);
    if (companyByIdResult.error) throw new Error(companyByIdResult.error.message);
    if (companyByContactResult.error) throw new Error(companyByContactResult.error.message);

    (byIdResult.data ?? []).forEach((m) => memberIds.add(m.Id));
    (byUserIdResult.data ?? []).forEach((m) => memberIds.add(m.Id));
    (companyByIdResult.data ?? []).forEach((c) => companyIds.add(c.Id));
    (companyByContactResult.data ?? []).forEach((c) => companyIds.add(c.Id));
  }

  return { memberIds: Array.from(memberIds), companyIds: Array.from(companyIds) };
}

async function searchOwnerIds(userSearch: string): Promise<string[]> {
  const principalIds = await searchOwnerPrincipalIds(userSearch);
  if (principalIds.memberIds.length === 0 && principalIds.companyIds.length === 0) {
    return [];
  }

  const ownerIds = new Set<string>();
  const ownerQueries: Promise<{ data: Array<{ Id: string }> | null; error: any }>[] = [];

  if (principalIds.memberIds.length > 0) {
    ownerQueries.push(
      supabase
        .from('Owners')
        .select('Id')
        .eq('IsDeleted', false)
        .eq('OwnerType', 'member')
        .in('MemberId', principalIds.memberIds)
    );
  }

  if (principalIds.companyIds.length > 0) {
    ownerQueries.push(
      supabase
        .from('Owners')
        .select('Id')
        .eq('IsDeleted', false)
        .eq('OwnerType', 'company')
        .in('CompanyId', principalIds.companyIds)
    );
  }

  const ownerResults = await Promise.all(ownerQueries);
  ownerResults.forEach((result) => {
    if (result.error) throw new Error(result.error.message);
    (result.data ?? []).forEach((owner) => ownerIds.add(owner.Id));
  });

  return Array.from(ownerIds);
}

async function buildOwnerIdentityByOwnerId(ownerIds: string[]): Promise<Map<string, OwnerIdentity>> {
  const uniqueOwnerIds = Array.from(new Set(ownerIds.filter(Boolean)));
  const ownerIdentityByOwnerId = new Map<string, OwnerIdentity>();
  if (uniqueOwnerIds.length === 0) return ownerIdentityByOwnerId;

  const { data: owners, error: ownersError } = await supabase
    .from('Owners')
    .select('Id,OwnerType,MemberId,CompanyId')
    .eq('IsDeleted', false)
    .in('Id', uniqueOwnerIds);

  if (ownersError) {
    throw new Error(ownersError.message);
  }

  const memberIds = Array.from(
    new Set((owners ?? []).map((owner: any) => owner.MemberId).filter((value: string | null) => Boolean(value)))
  );
  const companyIds = Array.from(
    new Set((owners ?? []).map((owner: any) => owner.CompanyId).filter((value: string | null) => Boolean(value)))
  );

  const [membersResult, companiesResult] = await Promise.all([
    memberIds.length > 0
      ? supabase.from('Members').select('Id,FirstName,LastName,Email').eq('IsDeleted', false).in('Id', memberIds)
      : Promise.resolve({ data: [], error: null }),
    companyIds.length > 0
      ? supabase.from('Companies').select('Id,Name,BillingEmail').eq('IsDeleted', false).in('Id', companyIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (membersResult.error) throw new Error(membersResult.error.message);
  if (companiesResult.error) throw new Error(companiesResult.error.message);

  const memberMap = new Map<string, any>((membersResult.data ?? []).map((member: any) => [member.Id, member]));
  const companyMap = new Map<string, any>((companiesResult.data ?? []).map((company: any) => [company.Id, company]));

  (owners ?? []).forEach((owner: any) => {
    if (owner.OwnerType === 'member' && owner.MemberId) {
      const member = memberMap.get(owner.MemberId);
      const name = [member?.FirstName, member?.LastName].filter(Boolean).join(' ').trim();
      if (name) {
        ownerIdentityByOwnerId.set(owner.Id, { name, email: member?.Email ?? '' });
      }
      return;
    }

    if (owner.OwnerType === 'company' && owner.CompanyId) {
      const company = companyMap.get(owner.CompanyId);
      const name = (company?.Name ?? '').trim();
      if (name) {
        ownerIdentityByOwnerId.set(owner.Id, { name, email: company?.BillingEmail ?? '' });
      }
    }
  });

  return ownerIdentityByOwnerId;
}

class PaymentsAdminService {
  async getBookings(filters: BookingFiltersInput): Promise<AdminPaymentBookingRow[]> {
    const userSearch = filters.userSearch.trim();
    const shouldFilterByOwner = userSearch.length > 0;
    let propertyIds: string[] = [];
    if (shouldFilterByOwner) {
      const ownerIds = await searchOwnerIds(userSearch);
      if (ownerIds.length === 0) {
        return [];
      }

      const { data: filteredProperties, error: propertiesError } = await supabase
        .from('EstateProperties')
        .select('Id')
        .eq('IsDeleted', false)
        .in('OwnerId', ownerIds);

      if (propertiesError) {
        throw new Error(propertiesError.message);
      }

      propertyIds = (filteredProperties ?? []).map((property) => property.Id);
      if (propertyIds.length === 0) {
        return [];
      }
    }

    let query = supabase
      .from('Bookings')
      .select(`
        Id,
        CheckInDate,
        CheckOutDate,
        TotalAmount,
        Currency,
        PaymentStatus,
        Guest:Members!FK_Bookings_Members_GuestId(
          Id,
          UserId,
          FirstName,
          LastName,
          Email
        ),
        EstateProperty:EstateProperties(
          Id,
          StreetName,
          HouseNumber,
          OwnerId
        )
      `)
      .eq('IsDeleted', false)
      .order('Created', { ascending: false })
      .limit(300);
    
    if (shouldFilterByOwner) {
      query = query.in('EstatePropertyId', propertyIds);
    }

    if (filters.paymentStatus === 'paid') {
      query = query.eq('PaymentStatus', 1);
    } else if (filters.paymentStatus === 'unpaid') {
      query = query.eq('PaymentStatus', 0);
    }

    if (filters.fromDate) {
      query = query.gte('CheckInDate', filters.fromDate);
    }
    if (filters.toDate) {
      query = query.lte('CheckOutDate', filters.toDate);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    const ownerIds = Array.from(
      new Set((data ?? []).map((row: any) => row.EstateProperty?.OwnerId).filter((value: string | null) => Boolean(value)))
    );
    const ownerIdentityByOwnerId = await buildOwnerIdentityByOwnerId(ownerIds as string[]);

    return (data ?? []).map((row: any) => {
      const propertyName = [row.EstateProperty?.StreetName, row.EstateProperty?.HouseNumber].filter(Boolean).join(' ').trim() || 'Sin propiedad';
      const ownerIdentity = ownerIdentityByOwnerId.get(row.EstateProperty?.OwnerId ?? '');

      return {
        id: row.Id,
        userName: ownerIdentity?.name ?? 'Sin propietario',
        userEmail: ownerIdentity?.email ?? '',
        userIdentifier: row.EstateProperty?.OwnerId ?? '',
        propertyName,
        checkInDate: row.CheckInDate,
        checkOutDate: row.CheckOutDate,
        totalAmount: Number(row.TotalAmount ?? 0),
        currency: Number(row.Currency ?? 0),
        paymentStatus: Number(row.PaymentStatus ?? 0)
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

    const { data, error } = await supabase.rpc('admin_get_booking_receipts', {
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
    const { data, error } = await supabase.rpc('admin_generate_booking_receipt', {
      p_booking_ids: bookingIds
    });

    if (error) {
      throw new Error(error.message);
    }

    return data as string;
  }

  async updateReceiptStatus(receiptId: string, isPaid: boolean): Promise<void> {
    const { error } = await supabase.rpc('admin_set_booking_receipt_status', {
      p_receipt_id: receiptId,
      p_is_paid: isPaid
    });

    if (error) {
      throw new Error(error.message);
    }
  }
}

const paymentsAdminService = new PaymentsAdminService();
export default paymentsAdminService;
