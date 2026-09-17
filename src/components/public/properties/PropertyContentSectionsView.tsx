import { Card } from 'flowbite-react';
import { pickSectionDescription, pickSectionName } from '../../../models/properties/propertyContentSections';
import type { PublicPropertyContentSection } from '../../../models/properties/PublicProperty';
import { resolveAssetUrl } from '../../../utils/resolveAssetUrl';

interface PropertyContentSectionsViewProps {
  sections?: PublicPropertyContentSection[];
  locale?: string;
}

export function PropertyContentSectionsView({
  sections,
  locale = 'es',
}: PropertyContentSectionsViewProps) {
  if (!sections?.length) return null;

  return (
    <div className="space-y-8 mb-8">
      {sections.map((section, index) => {
        const title = pickSectionName(section, locale);
        const description = pickSectionDescription(section, locale);
        const images = [...(section.images ?? [])].sort(
          (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
        );
        const layout = section.layoutType ?? 'split';
        const hero = section.layoutConfig?.displayVariant === 'hero';

        return (
          <Card key={`${section.templateKey ?? 'custom'}-${index}`} className="p-3">
            {title && <h2 className="text-2xl font-bold mb-4">{title}</h2>}
            {description && (
              <p className="mb-4 leading-relaxed whitespace-pre-line text-gray-700 dark:text-gray-200">
                {description}
              </p>
            )}
            {images.length > 0 && (
              <div
                className={
                  layout === 'carousel'
                    ? 'flex gap-3 overflow-x-auto pb-2'
                    : layout === 'stacked'
                      ? 'grid grid-cols-1 gap-3'
                      : 'grid grid-cols-1 sm:grid-cols-2 gap-3'
                }
              >
                {images.map((image, imageIndex) => (
                  <img
                    key={image.propertyImageId ?? `${index}-${imageIndex}`}
                    src={resolveAssetUrl(image.url)}
                    alt={image.altText || title || ''}
                    className={
                      layout === 'carousel'
                        ? `h-48 ${hero ? 'w-80' : 'w-64'} flex-shrink-0 rounded-lg object-cover`
                        : hero
                          ? 'w-full max-h-96 rounded-lg object-cover'
                          : 'w-full h-56 rounded-lg object-cover'
                    }
                  />
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
