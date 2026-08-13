/** Global hard maximum photos per property (all plans). */
export const GLOBAL_MAX_PHOTOS_PER_PROPERTY = 30;

/**
 * Effective photo cap for a property from an optional plan field.
 * Null/undefined plan cap → global max; plan caps above the global max are clamped.
 */
export function effectivePhotoCap(planMaxPhotosPerProperty: number | null | undefined): number {
  return Math.min(
    planMaxPhotosPerProperty ?? GLOBAL_MAX_PHOTOS_PER_PROPERTY,
    GLOBAL_MAX_PHOTOS_PER_PROPERTY
  );
}
