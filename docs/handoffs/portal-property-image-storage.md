# Portal property image storage

Guest portals are **read-only** for property media. Uploads happen only in the dashboard (panel) via R2 / local Supabase Storage; full public URLs are stored on `PropertyImages.Url`.

## Continuation (guest UI)

To wire featured images on search cards and the gallery on property detail in the guest frontend, follow:

**[`guest-property-images-frontend.md`](./guest-property-images-frontend.md)**

## Backend contract (summary)

| Consumer need | Source |
|---------------|--------|
| Search / list card photo | `portal_search_properties` → `imageUrl` / `imageAltText`; or list RPCs → `MainImageUrl` / `MainImageAltText` |
| Detail gallery | `get_public_*_property_by_id` → `Images` jsonb |
| Section-only photos | `ContentSections[].images` (unchanged; not the full gallery) |

Helpers (SECURITY DEFINER): `build_property_images_json`, `build_property_main_image_json`.

`PropertyImages` has **no** anon PostgREST SELECT. Guests must use the public RPCs above.

## Storage

See [README — File storage](../../README.md#file-storage-cloudflare-r2--supabase-storage-local). Display absolute public URLs as returned; guest apps do not upload or sign reads.
