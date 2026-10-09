import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  addCompanyMembership,
  createCompanyForMember,
  createHostUser,
  deleteE2EPlan,
  deleteSeededCompany,
  deleteSeededUser,
  insertE2EZeroCompanyPlan,
  type SeededCompany,
  type SeededUser,
} from './company-panel-seed';
import { futureStayDates } from './reservation-seed';

export type ManagerPanelSeed = {
  admin: SeededUser;
  manager: SeededUser;
  member: SeededUser;
  company: SeededCompany;
  propertyId: string;
  propertyTitle: string;
  guestName: string;
  guestEmail: string;
  pendingBookingId: string;
  visitCount: number;
  planId: string;
};

async function insertCompanyProperty(
  client: SupabaseClient,
  companyId: string,
  createdBy: string,
  streetName: string,
): Promise<string> {
  const { data: owner, error: ownerError } = await client
    .from('Owners')
    .insert({
      OwnerType: 'company',
      CompanyId: companyId,
      MemberId: null,
      IsDeleted: false,
    })
    .select('Id')
    .single();
  if (ownerError) throw ownerError;

  const propertyId = randomUUID();
  const now = new Date().toISOString();
  const { error: propertyError } = await client.from('EstateProperties').insert({
    Id: propertyId,
    StreetName: streetName,
    HouseNumber: '10',
    Neighborhood: 'Pocitos',
    City: 'Montevideo',
    State: 'Montevideo',
    ZipCode: '11300',
    Country: 'UY',
    LocationLatitude: -34.907,
    LocationLongitude: -56.149,
    Bedrooms: 2,
    Bathrooms: 1,
    HasGarage: false,
    GarageSpaces: 0,
    IsDeleted: false,
    OwnerId: owner.Id,
    Created: now,
    CreatedBy: createdBy,
    LastModified: now,
    LastModifiedBy: createdBy,
  });
  if (propertyError) throw propertyError;

  const { error: summerError } = await client.from('SummerRentExtension').insert({
    EstatePropertyId: propertyId,
    MinStayDays: 1,
    MaxStayDays: 30,
    CreatedBy: createdBy,
    LastModifiedBy: createdBy,
  });
  if (summerError) throw summerError;

  const { error: listingError } = await client.from('Listings').insert({
    EstatePropertyId: propertyId,
    ListingType: 'SummerRent',
    Title: streetName,
    Description: 'E2E seeded summer listing',
    AvailableFrom: now,
    Capacity: 4,
    Currency: 0,
    RentPrice: 100,
    IsPriceVisible: true,
    Status: 1,
    IsActive: true,
    IsPropertyVisible: true,
    IsFeatured: false,
    IsDeleted: false,
    Created: now,
    CreatedBy: createdBy,
    LastModified: now,
    LastModifiedBy: createdBy,
  });
  if (listingError) throw listingError;

  return propertyId;
}

async function insertVisitLogs(
  client: SupabaseClient,
  propertyId: string,
): Promise<number> {
  // Unique session per row so dedupe (session + property + Montevideo day) still counts each visit.
  const visits = [
    { utm_source: null as string | null, utm_medium: null as string | null, referrer: null as string | null },
    { utm_source: null, utm_medium: null, referrer: null },
    { utm_source: null, utm_medium: null, referrer: null },
    { utm_source: 'instagram', utm_medium: 'social', referrer: 'instagram.com' },
  ];

  let counted = 0;
  for (const visit of visits) {
    const { data, error } = await client.rpc('record_guest_visit', {
      p_session_id: randomUUID(),
      p_listing_type: 'SummerRent',
      p_page_key: 'property_detail',
      p_property_id: propertyId,
      p_page_host: 'localhost',
      p_referrer_host: visit.referrer,
      p_utm_source: visit.utm_source,
      p_utm_medium: visit.utm_medium,
      p_utm_campaign: null,
    });
    if (error) throw error;
    const result = data as { success?: boolean; counted_property?: boolean; error?: string };
    if (!result?.success) {
      throw new Error(`record_guest_visit failed: ${result?.error ?? 'unknown'}`);
    }
    if (result.counted_property) counted += 1;
  }
  return counted;
}

async function insertGuest(client: SupabaseClient): Promise<{ id: string; firstName: string; lastName: string; email: string }> {
  const firstName = 'Ana';
  const lastName = 'Huesped';
  const email = `ana.huesped.${Date.now()}@example.com`;
  const { data, error } = await client
    .from('Guests')
    .insert({
      FirstName: firstName,
      LastName: lastName,
      Email: email,
      PhoneNumber: '099111222',
    })
    .select('Id')
    .single();
  if (error) throw error;
  return { id: data.Id as string, firstName, lastName, email };
}

async function insertPendingBooking(
  client: SupabaseClient,
  propertyId: string,
  guestId: string,
): Promise<string> {
  const dates = futureStayDates(12);
  const { data, error } = await client
    .from('Bookings')
    .insert({
      EstatePropertyId: propertyId,
      GuestId: guestId,
      CheckInDate: dates.checkIn,
      CheckOutDate: dates.checkOut,
      Status: 0,
      GuestCount: 2,
      PaymentStatus: 0,
      Notes: `e2e-manager-booking ${Date.now()}`,
    })
    .select('Id')
    .single();
  if (error) throw error;
  return data.Id as string;
}

export async function seedManagerPanel(
  client: SupabaseClient,
  options?: { connectMercadoPago?: boolean },
): Promise<ManagerPanelSeed> {
  const admin = await createHostUser(client, { firstName: 'Panel', lastName: 'Admin' });
  const manager = await createHostUser(client, { firstName: 'Panel', lastName: 'Manager' });
  const member = await createHostUser(client, { firstName: 'Panel', lastName: 'Member' });
  const zeroPlan = await insertE2EZeroCompanyPlan(client);
  const company = await createCompanyForMember(client, admin, 'Admin', 'E2E Report Co');
  await addCompanyMembership(client, company.companyId, manager, 'Manager', admin.memberId);
  await addCompanyMembership(client, company.companyId, member, 'Member', admin.memberId);
  await client
    .from('BillingPlanAssignments')
    .update({ IsActive: false })
    .eq('SubjectType', 'company')
    .eq('MemberOrCompanyId', company.companyId);
  await client.from('BillingPlanAssignments').insert({
    SubjectType: 'company',
    MemberOrCompanyId: company.companyId,
    PlanId: zeroPlan.id,
    StartDate: new Date().toISOString(),
    IsActive: true,
  });

  const propertyTitle = `E2E Visitas ${Date.now()}`;
  const propertyId = await insertCompanyProperty(client, company.companyId, admin.authUserId, propertyTitle);
  const visitCount = await insertVisitLogs(client, propertyId);
  const guest = await insertGuest(client);
  const pendingBookingId = await insertPendingBooking(client, propertyId, guest.id);

  if (options?.connectMercadoPago) {
    const { error } = await client.from('mercado_pago_accounts').insert({
      member_id: admin.memberId,
      mp_user_id: `e2e-mp-${Date.now()}`,
      access_token_encrypted: 'e2e-encrypted-token',
      live_mode: false,
    });
    if (error) throw error;
  }

  return {
    admin,
    manager,
    member,
    company,
    propertyId,
    propertyTitle,
    guestName: `${guest.firstName} ${guest.lastName}`,
    guestEmail: guest.email,
    pendingBookingId,
    visitCount,
    planId: zeroPlan.id,
  };
}

export async function markBookingPaid(client: SupabaseClient, bookingId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await client
    .from('Bookings')
    .update({
      PaymentStatus: 1,
      MercadoPagoApprovedAt: now,
    })
    .eq('Id', bookingId);
  if (error) throw error;
}

export async function autoConfirmPaidBooking(
  client: SupabaseClient,
  bookingId: string,
): Promise<{ confirmed?: boolean; skipped_reason?: string }> {
  const { data, error } = await client.rpc('try_auto_confirm_paid_booking', {
    p_booking_id: bookingId,
  });
  if (error) throw error;
  return data as { confirmed?: boolean; skipped_reason?: string };
}

export async function cleanupManagerPanel(client: SupabaseClient, seed: ManagerPanelSeed): Promise<void> {
  await client.from('Bookings').delete().eq('EstatePropertyId', seed.propertyId);
  await client.from('AvailabilityBlocks').delete().eq('EstatePropertyId', seed.propertyId);
  const { data: integrations } = await client
    .from('CalendarIntegrations')
    .select('Id')
    .eq('EstatePropertyId', seed.propertyId);
  const integrationIds = (integrations ?? []).map((row) => row.Id as string);
  if (integrationIds.length > 0) {
    await client.from('SyncJobs').delete().in('CalendarIntegrationId', integrationIds);
    await client.from('ExternalCalendarEvents').delete().in('CalendarIntegrationId', integrationIds);
  }
  await client.from('CalendarIntegrations').delete().eq('EstatePropertyId', seed.propertyId);
  await client.from('SummerRentExtension').delete().eq('EstatePropertyId', seed.propertyId);
  await client.from('PropertyVisitLogs').delete().eq('PropertyId', seed.propertyId);
  await client.from('PropertyMessageLogs').delete().eq('PropertyId', seed.propertyId);
  await client.from('Listings').delete().eq('EstatePropertyId', seed.propertyId);
  const { data: property } = await client
    .from('EstateProperties')
    .select('OwnerId')
    .eq('Id', seed.propertyId)
    .maybeSingle();
  await client.from('EstateProperties').delete().eq('Id', seed.propertyId);
  if (property?.OwnerId) {
    await client.from('Owners').delete().eq('Id', property.OwnerId);
  }
  await client.from('mercado_pago_accounts').delete().eq('member_id', seed.admin.memberId);
  await deleteSeededCompany(client, seed.company.companyId);
  await deleteE2EPlan(client, seed.planId);
  await deleteSeededUser(client, seed.manager);
  await deleteSeededUser(client, seed.member);
  await deleteSeededUser(client, seed.admin);
}
