import { supabase } from '../config/supabase';

export type GuestPreviewListingType = 'SummerRent' | 'EventVenue';

export interface PropertyPreviewTarget {
  listingType: GuestPreviewListingType;
  hiddenFromGuests: boolean;
}

export interface PreviewListingRef {
  listingType?: string | null;
  isActive?: boolean | null;
  isPropertyVisible?: boolean | null;
  isDeleted?: boolean | null;
  createdAt?: Date | string | null;
}

const GUEST_PREVIEW_SITES: GuestPreviewListingType[] = ['SummerRent', 'EventVenue'];

export const GUEST_PREVIEW_SITE_LABEL: Record<GuestPreviewListingType, string> = {
  SummerRent: 'Casas',
  EventVenue: 'Espacios',
};

const NO_GUEST_PAGE_TITLE = 'Esta propiedad no tiene una página en Casas ni en Espacios.';

export function noGuestPreviewTitle(): string {
  return NO_GUEST_PAGE_TITLE;
}

function createdMs(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

/** Same choice as current_guest_listing_id: active listing, otherwise the newest. */
export function guestPreviewTargets(
  listings: PreviewListingRef[] | null | undefined,
): PropertyPreviewTarget[] {
  const rows = listings ?? [];
  const targets: PropertyPreviewTarget[] = [];

  for (const site of GUEST_PREVIEW_SITES) {
    const matches = rows.filter((row) => row.listingType === site && !row.isDeleted);
    if (matches.length === 0) continue;

    const current = [...matches].sort((a, b) => {
      const activeDelta = Number(!!b.isActive) - Number(!!a.isActive);
      if (activeDelta !== 0) return activeDelta;
      return createdMs(b.createdAt) - createdMs(a.createdAt);
    })[0];

    targets.push({
      listingType: site,
      hiddenFromGuests: !(!!current.isActive && !!current.isPropertyVisible),
    });
  }

  return targets;
}

function guestSiteOrigin(listingType: GuestPreviewListingType): string {
  const raw =
    listingType === 'SummerRent'
      ? import.meta.env.VITE_GUEST_SITE_CASAS_ORIGIN
      : import.meta.env.VITE_GUEST_SITE_ESPACIOS_ORIGIN;
  const origin = typeof raw === 'string' ? raw.trim().replace(/\/$/, '') : '';
  if (!origin) {
    const site = GUEST_PREVIEW_SITE_LABEL[listingType];
    throw new Error(`Falta la dirección del sitio ${site}.`);
  }
  return origin;
}

export function buildGuestPreviewUrl(
  listingType: GuestPreviewListingType,
  propertyId: string,
  token: string,
): string {
  const path = listingType === 'SummerRent' ? `/property/${propertyId}` : `/venue/${propertyId}`;
  const url = new URL(path, `${guestSiteOrigin(listingType)}/`);
  url.searchParams.set('preview', token);
  return url.toString();
}

export async function listPropertyPreviewTargets(propertyId: string): Promise<PropertyPreviewTarget[]> {
  const { data, error } = await supabase.rpc('list_property_preview_targets', {
    p_estate_property_id: propertyId,
  });
  if (error) throw error;

  return ((data ?? []) as { listing_type?: string; hidden_from_guests?: boolean }[])
    .filter(
      (row): row is { listing_type: GuestPreviewListingType; hidden_from_guests?: boolean } =>
        row.listing_type === 'SummerRent' || row.listing_type === 'EventVenue',
    )
    .map((row) => ({
      listingType: row.listing_type,
      hiddenFromGuests: !!row.hidden_from_guests,
    }));
}

export async function openPropertyPreview(
  propertyId: string,
  listingType: GuestPreviewListingType,
): Promise<void> {
  buildGuestPreviewUrl(listingType, propertyId, 'pending');

  const popup = window.open('about:blank', '_blank');
  if (!popup) {
    throw new Error('El navegador bloqueó la pestaña. Permití ventanas emergentes e intentá de nuevo.');
  }

  try {
    const { data, error } = await supabase.rpc('create_property_preview_token', {
      p_estate_property_id: propertyId,
      p_listing_type: listingType,
    });
    if (error) throw error;

    const row = ((data ?? []) as { token?: string }[])[0];
    const token = row?.token;
    if (!token) throw new Error('No se pudo crear la vista previa.');

    popup.location.replace(buildGuestPreviewUrl(listingType, propertyId, token));
  } catch (error) {
    popup.close();
    throw error;
  }
}
