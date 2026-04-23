import type { PropertyType } from './PropertyData';

export function getPropertyTypeLabelEs(pt: PropertyType | null | undefined): string {
  if (!pt) return 'Selecciona el tipo de propiedad';
  if (pt === 'RealEstate') return 'Venta / alquiler anual';
  if (pt === 'SummerRent') return 'Alquiler de temporada';
  if (pt === 'EventVenue') return 'Eventos';
  return pt;
}
