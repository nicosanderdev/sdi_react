import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Label, Textarea } from 'flowbite-react';
import type { PropertyFormData } from '../../../models/properties/PropertyFormSchema';
import {
  AMENITY_LANGUAGES,
  AMENITY_LANGUAGE_LABELS,
  type AmenityLanguage
} from '../../../models/properties/amenityDescriptions';

interface AmenityDescriptionsSectionProps {
  selectedAmenityIds: string[];
  amenityNameById: Map<string, string>;
}

function amenityHasDescriptions(
  entry: Partial<Record<AmenityLanguage, string>> | undefined
): boolean {
  if (!entry) return false;
  return AMENITY_LANGUAGES.some(lang => !!entry[lang]?.trim());
}

export function AmenityDescriptionsSection({
  selectedAmenityIds,
  amenityNameById,
}: AmenityDescriptionsSectionProps) {
  const { watch, setValue } = useFormContext<PropertyFormData>();
  const amenityDescriptions = watch('amenityDescriptions') ?? {};
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setExpandedIds(prev => {
      const next = new Set<string>();
      for (const id of selectedAmenityIds) {
        if (prev.has(id)) {
          next.add(id);
          continue;
        }
        if (amenityHasDescriptions(amenityDescriptions[id])) {
          next.add(id);
        }
      }
      return next;
    });
  }, [selectedAmenityIds]);

  if (selectedAmenityIds.length === 0) return null;

  const setDescription = (amenityId: string, lang: AmenityLanguage, value: string) => {
    const current = amenityDescriptions[amenityId] ?? {};
    const next = { ...current, [lang]: value || undefined };
    if (!value.trim()) delete next[lang as keyof typeof next];
    const entry = Object.keys(next).length > 0 ? next : undefined;
    const all = { ...amenityDescriptions };
    if (entry) all[amenityId] = entry;
    else delete all[amenityId];
    setValue('amenityDescriptions', Object.keys(all).length > 0 ? all : undefined, {
      shouldDirty: true,
    });
  };

  const toggleExpanded = (amenityId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(amenityId)) next.delete(amenityId);
      else next.add(amenityId);
      return next;
    });
  };

  return (
    <div className="border-t border-gray-200 pt-6 mt-6">
      <h3 className="text-lg font-semibold mb-2">Servicios con descripción</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Opcional: expande cada servicio para añadir texto por idioma. Si no completas ningún
        idioma, el portal mostrará solo el nombre del servicio.
      </p>
      <div className="space-y-2">
        {selectedAmenityIds.map(amenityId => {
          const name = amenityNameById.get(amenityId) ?? 'Servicio';
          const entry = amenityDescriptions[amenityId] ?? {};
          const isExpanded = expandedIds.has(amenityId);
          const hasFilled = amenityHasDescriptions(entry);

          return (
            <div
              key={amenityId}
              className="rounded-lg border border-gray-200 bg-gray-50 dark:bg-gray-800 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleExpanded(amenityId)}
                aria-expanded={isExpanded}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-100/80 dark:hover:bg-gray-700/80 transition-colors"
              >
                <span className="font-medium text-gray-900 dark:text-gray-100">{name}</span>
                <span className="flex items-center gap-2 shrink-0">
                  {!isExpanded && hasFilled && (
                    <span className="text-xs text-primary-700 bg-primary-50 px-2 py-0.5 rounded">
                      Con descripción
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" aria-hidden />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400" aria-hidden />
                  )}
                </span>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-gray-200 space-y-4">
                  {AMENITY_LANGUAGES.map(lang => (
                    <div key={lang}>
                      <Label htmlFor={`amenity-desc-${amenityId}-${lang}`}>
                        {AMENITY_LANGUAGE_LABELS[lang]}
                      </Label>
                      <Textarea
                        id={`amenity-desc-${amenityId}-${lang}`}
                        rows={2}
                        maxLength={500}
                        placeholder={`Descripción en ${AMENITY_LANGUAGE_LABELS[lang]} (opcional)`}
                        value={entry[lang] ?? ''}
                        onChange={e => setDescription(amenityId, lang, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
