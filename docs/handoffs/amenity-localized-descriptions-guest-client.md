# Handoff: Amenity localized descriptions (guest client)

**Source repo:** `sdi_react` (SQL + dashboard form)  
**Target:** Guest apps (`sdi_trips` SummerRent, EventVenue)

**Portal integration (RPC payload, parsing, UI):** see **[`portal-public-property-amenities-rpc.md`](portal-public-property-amenities-rpc.md)** — primary handoff for `get_public_summer_rent_property_by_id` / `get_public_event_venue_property_by_id`.

**Migrations (apply manually, in order):**

1. [`supabase/migrations/20260610120000_estate_property_amenity_localized_descriptions.sql`](../supabase/migrations/20260610120000_estate_property_amenity_localized_descriptions.sql)
2. [`supabase/migrations/20260610120100_public_property_rpcs_amenity_descriptions.sql`](../supabase/migrations/20260610120100_public_property_rpcs_amenity_descriptions.sql) (optional comment-only)
3. [`supabase/migrations/20260610120200_amenity_descriptions_rpc_patches.sql`](../supabase/migrations/20260610120200_amenity_descriptions_rpc_patches.sql) — `update_estate_property`, public `get_public_*_property_by_id`, `duplicate_estate_property`

---

## Summary

Property managers can add optional per-amenity copy in **English**, **Spanish**, and **Portuguese**. Data lives in `EstatePropertyAmenity.LocalizedDescriptions` (jsonb). Public detail RPCs should expose amenities via `public.build_property_amenities_json(estate_property_id)`.

---

## Amenity payload shape

```json
{
  "id": "uuid",
  "name": "Piscina",
  "iconId": "pool",
  "descriptions": {
    "es": "Piscina climatizada todo el año",
    "en": "Heated pool year-round"
  }
}
```

- `descriptions` is **omitted** when there is no custom copy (show name only).
- Allowed keys: `en`, `es`, `pt`.

---

## RPC summary

Migration `20260610120200` adds **`Amenities`** (`jsonb`) on the two **by-id** public RPCs. **`AmenityNames`** is unchanged. List RPCs and `portal_search_properties` are unchanged.

Full contract, TypeScript types, parsing, and UI rules: [`portal-public-property-amenities-rpc.md`](portal-public-property-amenities-rpc.md).

Keep host-contact PII rules from [`backend-handoff-host-contact-for-guests.txt`](backend-handoff-host-contact-for-guests.txt).

---

## Dashboard (sdi_react)

- Form step 2: section **“Servicios con descripción”** after amenity checkboxes.
- `create_estate_property` / `update_estate_property`: pass `p_amenity_links` jsonb array.
