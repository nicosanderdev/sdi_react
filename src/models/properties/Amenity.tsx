export type AmenityLanguage = 'en' | 'es' | 'pt';

export interface Amenity {
  id: string;
  key?: string;
  name: string;
  iconId?: string;
  localizedName?: Partial<Record<AmenityLanguage, string>>;
  /** Resolved guest copy; keys en, es, pt */
  descriptions?: Partial<Record<AmenityLanguage, string>>;
}
