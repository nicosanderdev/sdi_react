import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Label, Textarea } from 'flowbite-react';
import type { PropertyFormData } from '../../../models/properties/PropertyFormSchema';
import {
  AMENITY_LANGUAGES,
  AMENITY_LANGUAGE_LABELS,
  type AmenityLanguage,
} from '../../../models/properties/amenityDescriptions';
import {
  amenityTemplateDescription,
  amenityTemplateName,
  type AmenityTemplate,
} from '../../../models/properties/amenityTemplates';
import { hasLocalizedText } from '../../../models/properties/localizedText';

interface AmenityDescriptionsSectionProps {
  selectedKeys: string[];
  templatesByKey: Map<string, AmenityTemplate>;
  canWriteCustom?: boolean;
}

export function AmenityDescriptionsSection({
  selectedKeys,
  templatesByKey,
  canWriteCustom = false,
}: AmenityDescriptionsSectionProps) {
  const { watch, setValue } = useFormContext<PropertyFormData>();
  const amenityDescriptions = watch('amenityDescriptions') ?? {};
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setExpandedKeys(prev => {
      const next = new Set<string>();
      for (const key of selectedKeys) {
        if (prev.has(key) || hasLocalizedText(amenityDescriptions[key])) {
          next.add(key);
        }
      }
      return next;
    });
  }, [selectedKeys]);

  if (selectedKeys.length === 0) return null;

  const visibleKeys = selectedKeys.filter(key => {
    if (canWriteCustom) return true;
    const template = templatesByKey.get(key);
    return !!template && !!amenityTemplateDescription(template);
  });

  if (visibleKeys.length === 0) return null;

  const setDescription = (amenityKey: string, lang: AmenityLanguage, value: string) => {
    const current = amenityDescriptions[amenityKey] ?? {};
    const next = { ...current, [lang]: value || undefined };
    if (!value.trim()) delete next[lang as keyof typeof next];
    const entry = Object.keys(next).length > 0 ? next : undefined;
    const all = { ...amenityDescriptions };
    if (entry) all[amenityKey] = entry;
    else delete all[amenityKey];
    setValue('amenityDescriptions', Object.keys(all).length > 0 ? all : undefined, {
      shouldDirty: true,
    });
  };

  const toggleExpanded = (amenityKey: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(amenityKey)) next.delete(amenityKey);
      else next.add(amenityKey);
      return next;
    });
  };

  return (
    <div className="border-t border-gray-200 pt-6 mt-6">
      <h3 className="text-lg font-semibold mb-2">Descripción de servicios</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {canWriteCustom
          ? 'El portal muestra el texto del catálogo. Como administrador podés reemplazarlo por una descripción personalizada (es / en / pt). Vaciar los tres idiomas vuelve al texto del catálogo.'
          : 'El portal muestra el texto del catálogo. No es necesario traducirlo.'}
      </p>
      <div className="space-y-2">
        {visibleKeys.map(amenityKey => {
          const template = templatesByKey.get(amenityKey);
          const name = template ? amenityTemplateName(template) : amenityKey;
          const seeded = template ? amenityTemplateDescription(template) : undefined;
          const entry = amenityDescriptions[amenityKey] ?? {};
          const hasCustom = hasLocalizedText(entry);
          const isExpanded = expandedKeys.has(amenityKey);

          return (
            <div
              key={amenityKey}
              className="rounded-lg border border-gray-200 bg-gray-50 dark:bg-gray-800 overflow-hidden"
            >
              {canWriteCustom ? (
                <button
                  type="button"
                  onClick={() => toggleExpanded(amenityKey)}
                  aria-expanded={isExpanded}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-100/80 dark:hover:bg-gray-700/80 transition-colors"
                >
                  <span className="font-medium text-gray-900 dark:text-gray-100">{name}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    {hasCustom && (
                      <span className="text-xs text-primary-700 bg-primary-50 px-2 py-0.5 rounded">
                        Personalizada
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" aria-hidden />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500" aria-hidden />
                    )}
                  </span>
                </button>
              ) : (
                <div className="px-4 py-3">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{name}</span>
                </div>
              )}

              {(!canWriteCustom || !isExpanded) && seeded && !hasCustom && (
                <p className="px-4 pb-3 text-sm text-gray-600 dark:text-gray-400">{seeded}</p>
              )}

              {canWriteCustom && isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-gray-200 space-y-4">
                  {seeded && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Catálogo: </span>
                      {seeded}
                    </p>
                  )}
                  {AMENITY_LANGUAGES.map(lang => (
                    <div key={lang}>
                      <Label htmlFor={`amenity-desc-${amenityKey}-${lang}`}>
                        {AMENITY_LANGUAGE_LABELS[lang]}
                      </Label>
                      <Textarea
                        id={`amenity-desc-${amenityKey}-${lang}`}
                        rows={2}
                        maxLength={500}
                        placeholder={`Descripción en ${AMENITY_LANGUAGE_LABELS[lang]} (opcional)`}
                        value={entry[lang] ?? ''}
                        onChange={e => setDescription(amenityKey, lang, e.target.value)}
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
