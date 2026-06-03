export type AmenityLanguage = 'en' | 'es' | 'pt';

export interface Amenity {
  id: string;
  name: string;
  iconId?: string;
  /** Per-property custom copy; keys en, es, pt */
  descriptions?: Partial<Record<AmenityLanguage, string>>;
}