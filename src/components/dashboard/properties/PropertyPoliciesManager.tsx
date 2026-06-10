import { Button, Label, Select } from 'flowbite-react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import type { PropertyFormData, PropertyPolicyFormData } from '../../../models/properties/PropertyFormSchema';
import type { ListingType } from '../../../models/properties/PropertyData';
import { resolveCreationListingType } from '../../../models/properties/PropertyFormSchema';
import { getListingTypeLabelEs } from '../../../models/properties/propertyTypeLabels';
import { LocalizedTitleDescriptionFields } from './LocalizedTextFields';

const ALL_LISTING_TYPES: ListingType[] = ['SummerRent', 'EventVenue', 'AnnualRent', 'RealEstate'];

interface PropertyPoliciesManagerProps {
  /** On edit, allow all listing types present on the property. */
  allowedListingTypes?: ListingType[];
}

export function PropertyPoliciesManager({ allowedListingTypes }: PropertyPoliciesManagerProps) {
  const { control, watch, setValue } = useFormContext<PropertyFormData>();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'propertyPolicies',
  });

  const propertyType = watch('propertyType');
  const realEstateOfferMode = watch('realEstateOfferMode');
  const defaultListingType =
    resolveCreationListingType({ propertyType, realEstateOfferMode }) ??
    allowedListingTypes?.[0] ??
    'SummerRent';

  const listingOptions = allowedListingTypes?.length ? allowedListingTypes : ALL_LISTING_TYPES;

  const createPolicyDraft = (): PropertyPolicyFormData => ({
    listingType: defaultListingType,
    title: {},
    description: {},
  });

  return (
    <div className="p-4 md:p-6 border rounded-lg border-gray-200 dark:border-gray-700 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Políticas de la propiedad</h3>
          <p className="text-sm text-gray-500">
            Reglas y condiciones por tipo de publicación (sitio). No están vinculadas a un listing
            concreto.
          </p>
        </div>
        <Button type="button" onClick={() => append(createPolicyDraft())}>
          <Plus size={16} className="mr-2" />
          Agregar política
        </Button>
      </div>

      {fields.length === 0 && (
        <div className="rounded-lg border border-dashed p-4 text-sm text-gray-500">
          Opcional: agrega políticas como cancelación, mascotas o normas de la casa.
        </div>
      )}

      <div className="space-y-4">
        {fields.map((field, index) => {
          const policy = watch(`propertyPolicies.${index}`);
          return (
            <div
              key={field.id}
              className="rounded-lg border border-gray-200 dark:border-gray-700 border-dashed p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h4 className="font-medium">Política {index + 1}</h4>
                <div className="flex items-center gap-2">
                  <Button
                    size="xs"
                    color="light"
                    type="button"
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    <ChevronUp size={14} />
                  </Button>
                  <Button
                    size="xs"
                    color="light"
                    type="button"
                    disabled={index === fields.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    <ChevronDown size={14} />
                  </Button>
                  <Button size="xs" color="failure" type="button" onClick={() => remove(index)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>

              <div className="max-w-xs">
                <Label htmlFor={`propertyPolicies.${index}.listingType`}>Tipo de publicación</Label>
                <Select
                  id={`propertyPolicies.${index}.listingType`}
                  className="mt-2"
                  value={policy?.listingType ?? defaultListingType}
                  onChange={e =>
                    setValue(`propertyPolicies.${index}.listingType`, e.target.value as ListingType, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                >
                  {listingOptions.map(lt => (
                    <option key={lt} value={lt}>
                      {getListingTypeLabelEs(lt)}
                    </option>
                  ))}
                </Select>
              </div>

              <LocalizedTitleDescriptionFields
                idPrefix={`policy-${index}`}
                title={policy?.title ?? {}}
                description={policy?.description ?? {}}
                onTitleChange={next =>
                  setValue(`propertyPolicies.${index}.title`, next, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                onDescriptionChange={next =>
                  setValue(`propertyPolicies.${index}.description`, next, {
                    shouldDirty: true,
                  })
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
