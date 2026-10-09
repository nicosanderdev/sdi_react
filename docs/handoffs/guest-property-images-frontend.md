# Guest property images — frontend continuation

Consumer apps: guest / trips sites (**espacios** EventVenue, **casas** SummerRent) — not the sdi_react dashboard UI.  
Backend ownership: this repo (`supabase` RPCs). Migration: `20260918180000_public_property_images.sql`.

TypeScript contracts: [`src/types/guestReviewContract.ts`](../../src/types/guestReviewContract.ts) (`PublicPropertyImage`), [`src/services/search/types.ts`](../../src/services/search/types.ts) (`PortalSearchResultItem.imageUrl`).

Storage facts (read-only for portals): [`portal-property-image-storage.md`](./portal-property-image-storage.md).

## Prerequisite

Point the guest app at an environment where `20260918180000_public_property_images.sql` is applied (local after migrate, or staging after deploy). Until then, image fields are absent — treat as empty and keep placeholders.

## What the backend now returns

| Surface | RPC | Fields |
|---------|-----|--------|
| Ranked search | `portal_search_properties` | Per item: `imageUrl`, `imageAltText` (camelCase; `null` when no photos) |
| EventVenue list | `get_public_event_venue_properties` | `MainImageUrl`, `MainImageAltText` |
| SummerRent list | `get_public_summer_rent_properties` | `MainImageUrl`, `MainImageAltText` |
| EventVenue homepage featured | `get_public_featured_event_venue_properties` | `MainImageUrl`, `MainImageAltText` (same list row) |
| SummerRent homepage featured | `get_public_featured_summer_rent_properties` | `MainImageUrl`, `MainImageAltText` (same list row) |
| EventVenue detail | `get_public_event_venue_property_by_id` | `Images` jsonb array |
| SummerRent detail | `get_public_summer_rent_property_by_id` | `Images` jsonb array |

### Search / list featured image

```json
{
  "imageUrl": "https://property-images.example.com/properties/….jpg",
  "imageAltText": "Salon principal"
}
```

List RPC columns use PascalCase: `MainImageUrl`, `MainImageAltText`. Same meaning.

### Detail gallery item (`Images[]`)

```json
{
  "propertyImageId": "<uuid>",
  "url": "https://…",
  "altText": "…",
  "isMain": true,
  "displayOrder": 0
}
```

Ordered: `isMain` first, then `displayOrder`, then created. Empty array `[]` when the property has no photos.

`ContentSections[].images` remain **section-local** (host-assigned). They are **not** the property gallery — do not substitute them for `Images`.

## URL handling

Render `url` / `imageUrl` as-is. Values are already public R2 or local Supabase Storage URLs written by the panel upload flow.

Guest apps:

- Do **not** upload property media
- Do **not** request signed URLs for reads
- Do **not** PostgREST-join `PropertyImages` (no anon SELECT RLS)

## Empty / missing fields

| Case | UI |
|------|-----|
| `imageUrl` / `MainImageUrl` is `null` or missing | Keep current default/placeholder on search cards |
| `Images` is `[]` or missing | Empty gallery on detail (no fake photos) |
| Old backend without migration | Same as empty |

## Ordered frontend steps

Complete in order. Each step is done when its criterion holds.

### 1. Types

Extend search and detail TypeScript types with `imageUrl` / `imageAltText` (or list `MainImageUrl` / `MainImageAltText`) and `Images: PublicPropertyImage[]`.

**Done when:** types compile and include the new fields; optional fields tolerate older backends.

### 2. RPC mapping

Map RPC rows without dropping `Images`, `imageUrl`, or `MainImageUrl`.

**Done when:** a logged or inspected mapped object shows the image fields for a property that has photos in the panel.

### 3. Search cards (and map pins if applicable)

Bind featured image on list/search cards from `imageUrl` (or `MainImageUrl`). Placeholder only when null.

**Done when:** EventVenue search shows real photos for properties that have them in the panel; properties without photos still show the default image.

### 4. Property detail gallery

Bind `Images` on the detail page: hero = item with `isMain` or first item; remaining = thumbnails / lightbox.

**Done when:** EventVenue detail shows the same gallery order as the panel (main first); empty gallery when no photos.

### 5. Verify SummerRent (if shared client)

Repeat search + detail for casas / SummerRent when the same client code is shared.

**Done when:** SummerRent search and detail show images the same way, or the SummerRent site is documented as out of scope for this pass.

## Out of scope for the guest agent

- Changing Supabase RPCs, RLS, or migrations
- Panel upload / `ImageManager` / R2 configuration
- Opening `PropertyImages` to anonymous PostgREST
- Calling `build_property_images_json` or `build_property_main_image_json` directly — use only the search / list / featured / detail RPCs (helpers are not guest-callable)

Homepage ranking (not images): [`guest-featured-properties-frontend.md`](./guest-featured-properties-frontend.md).

## Smoke checks (guest app)

1. Search EventVenue → cards with panel photos show `imageUrl`.
2. Open one of those properties → detail gallery matches panel.
3. Property with zero photos → placeholder on search; empty gallery on detail.
4. Section content images still render from `ContentSections` independently of `Images`.
