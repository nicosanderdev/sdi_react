-- Merge guide: include localized amenity descriptions in public property detail RPCs.
-- Functions get_public_summer_rent_property_by_id and get_public_event_venue_property_by_id
-- are maintained in your live database; this file does not replace full RPC bodies.
-- Prerequisite: 20260610120000_estate_property_amenity_localized_descriptions.sql
-- Manual apply by project owner.

begin;

-- ---------------------------------------------------------------------------
-- Example patch (apply inside each RPC where the response JSON is built):
--
--   'amenities', public.build_property_amenities_json(ep."Id")
--
-- Replace any prior amenities subquery/array that only returned id/name/iconId.
-- Do not expose owner email/phone (see docs/handoffs/backend-handoff-host-contact-for-guests.txt).
-- ---------------------------------------------------------------------------

comment on function public.build_property_amenities_json(uuid) is
  'Use in get_public_summer_rent_property_by_id and get_public_event_venue_property_by_id as amenities payload.';

commit;
