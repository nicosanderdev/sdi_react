/**
 * Seeds booking rows for admin E2E using columns aligned with tasks/task-context.txt
 * (Bookings, EstateProperties, Owners, Members). No EstateProperties.Title — titles live on Listings.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { TEST_USERS } from '../utils/auth.setup';

export type CreateReservationOptions = {
  /** 0 = Pending, 1 = Confirmed, 2 = Cancelled */
  status: number;
  checkIn: string;
  checkOut: string;
  guestCount?: number;
  notesSuffix?: string;
};

/** ISO date strings yyyy-MM-dd, checkout strictly after check-in */
export function futureStayDates(daysAhead = 10): { checkIn: string; checkOut: string } {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setDate(start.getDate() + daysAhead);
  const end = new Date(start);
  end.setDate(end.getDate() + 2);
  return {
    checkIn: start.toISOString().slice(0, 10),
    checkOut: end.toISOString().slice(0, 10),
  };
}

async function resolveMemberIdForAdminEmail(
  client: SupabaseClient,
  email: string
): Promise<string> {
  const { data: byEmail, error: emailErr } = await client
    .from('Members')
    .select('Id')
    .ilike('Email', email)
    .eq('IsDeleted', false)
    .maybeSingle();
  if (emailErr) throw emailErr;
  if (byEmail?.Id) return byEmail.Id;

  const { data: listData, error: listErr } = await client.auth.admin.listUsers({
    perPage: 200,
    page: 1,
  });
  if (listErr) throw listErr;
  const user = listData.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );
  if (!user) {
    throw new Error(
      `E2E: No auth user or Member with Email matching ADMIN_USER_EMAIL="${email}".`
    );
  }
  const { data: byUser, error: memberErr } = await client
    .from('Members')
    .select('Id')
    .eq('UserId', user.id)
    .eq('IsDeleted', false)
    .maybeSingle();
  if (memberErr) throw memberErr;
  if (!byUser?.Id) {
    throw new Error(`E2E: Members row missing for admin auth user id=${user.id}.`);
  }
  return byUser.Id;
}

async function getOrCreateOwnerId(client: SupabaseClient, memberId: string): Promise<string> {
  const { data: existing, error: selErr } = await client
    .from('Owners')
    .select('Id')
    .eq('MemberId', memberId)
    .eq('OwnerType', 'member')
    .eq('IsDeleted', false)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing?.Id) return existing.Id;

  const { data: inserted, error: insErr } = await client
    .from('Owners')
    .insert({
      OwnerType: 'member',
      MemberId: memberId,
      CompanyId: null,
      IsDeleted: false,
    })
    .select('Id')
    .single();
  if (insErr) throw insErr;
  return inserted.Id as string;
}

/**
 * Minimal EstateProperties row per tasks/task-context.txt (required numerics + OwnerId).
 */
async function ensureEstatePropertyId(
  client: SupabaseClient,
  ownerId: string
): Promise<string> {
  const { data: rows, error: selErr } = await client
    .from('EstateProperties')
    .select('Id')
    .eq('OwnerId', ownerId)
    .eq('IsDeleted', false)
    .limit(1);
  if (selErr) throw selErr;
  const first = rows?.[0];
  if (first?.Id) return first.Id as string;

  const id = randomUUID();
  const payload = {
    Id: id,
    StreetName: 'E2E Admin Bookings',
    HouseNumber: '1',
    Neighborhood: 'Seed',
    City: 'Montevideo',
    State: 'Montevideo',
    ZipCode: '11000',
    Country: 'UY',
    LocationLatitude: -34.9011,
    LocationLongitude: -56.1645,
    Bedrooms: 1,
    Bathrooms: 1,
    HasGarage: false,
    GarageSpaces: 0,
    IsDeleted: false,
    OwnerId: ownerId,
  };
  const { error: insErr } = await client.from('EstateProperties').insert(payload);
  if (insErr) {
    throw new Error(
      `${insErr.message}. Align insert with tasks/task-context.txt or edit and apply ` +
        'supabase/migrations/20990101000000_e2e_minimal_booking_seed_stub.sql'
    );
  }
  return id;
}

export async function createReservation(
  client: SupabaseClient,
  options: CreateReservationOptions
): Promise<{ bookingId: string; estatePropertyId: string; notesMarker: string }> {
  const adminEmail = TEST_USERS.admin.email;
  const memberId = await resolveMemberIdForAdminEmail(client, adminEmail);
  const ownerId = await getOrCreateOwnerId(client, memberId);
  const estatePropertyId = await ensureEstatePropertyId(client, ownerId);

  const notesMarker =
    options.notesSuffix ?? `e2e-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const notes = `e2e-booking ${notesMarker}`;

  const { data: booking, error } = await client
    .from('Bookings')
    .insert({
      EstatePropertyId: estatePropertyId,
      GuestId: null,
      CheckInDate: options.checkIn,
      CheckOutDate: options.checkOut,
      Status: options.status,
      GuestCount: options.guestCount ?? 2,
      Notes: notes,
    })
    .select('Id')
    .single();

  if (error) {
    throw new Error(
      `E2E: Bookings insert failed: ${error.message}. See tasks/task-context.txt for column constraints.`
    );
  }

  return {
    bookingId: booking.Id as string,
    estatePropertyId,
    notesMarker,
  };
}

export async function deleteReservation(
  client: SupabaseClient,
  bookingId: string
): Promise<void> {
  await client.from('Bookings').update({ IsDeleted: true }).eq('Id', bookingId);
}
