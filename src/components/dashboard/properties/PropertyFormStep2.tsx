import React from 'react';
import { useFormContext } from 'react-hook-form';
import { PropertyFormData } from './AddPropertyForm';
import { Button, Label, Select, TextInput, Textarea, Checkbox } from 'flowbite-react';

interface PropertyFormStep2Props {
  onNext: () => void;
  onBack: () => void;
}

export function PropertyFormStep2({
  onNext,
  onBack
}: PropertyFormStep2Props) {
  const { register, formState: { errors }, watch, trigger } = useFormContext<PropertyFormData>();
  const currency = watch('currency');
  const hasCommonExpenses = watch('hasCommonExpenses');
  const hasGarage = watch('hasGarage');

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    // --- UPDATED: Add all required fields from this step to the validation array ---
    const fieldsToValidate: (keyof PropertyFormData)[] = [
      'title',
      'type',
      'areaValue',
      'areaUnit',
      'status',
      'capacity',
      'bedrooms',
      'bathrooms',
      'garageSpaces',
      'availableFrom',
      'salePrice',
      'rentPrice',
      'commonExpensesAmount'
    ];
    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      onNext();
    }
  };

  return (
    <form onSubmit={handleNext} className="max-w-2xl mx-auto">
      {/* --- ADDED: Container for new fields for better layout --- */}
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">Información Principal</h3>
          {/* --- ADDED: Title Field --- */}
          <div>
            <div className="mb-2 block">
                <Label htmlFor="title">
                Título de la Publicación*
                </Label>
            </div>
            <TextInput
              id="title"
              {...register('title')}
              placeholder="Ej: Apartamento moderno en el centro"/>
            {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>}
          </div>
        </div>

        {/* --- ADDED: Grid container for Type, Status, Area --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* --- ADDED: Property Type Field --- */}
          <div>
            <div className="mb-2 block">
                <Label htmlFor="type">
                Tipo de Propiedad*
                </Label>
            </div>
            <Select
              id="type"
              {...register('type')}>
              <option value="">Seleccione un tipo</option>
              <option value="apartment">Apartamento</option>
              <option value="house">Casa</option>
              <option value="commercial">Comercial</option>
              <option value="land">Terreno</option>
              <option value="other">Otro</option>
            </Select>
            {errors.type && <p className="text-red-500 text-sm mt-1">{errors.type.message}</p>}
          </div>

          {/* --- ADDED: Status Field --- */}
          <div>
            <div className="mb-2 block">
              <Label htmlFor="status">
                Estado*
              </Label>
            </div>
            <Select
              id="status"
              {...register('status')}
            >
              <option value="">Seleccione un estado</option>
              <option value="sale">En Venta</option>
              <option value="rent">En Alquiler</option>
              <option value="reserved">Reservado</option>
              <option value="sold">Vendido</option>
              <option value="unavailable">No Disponible</option>
            </Select>
            {errors.status && <p className="text-red-500 text-sm mt-1">{errors.status.message}</p>}
          </div>
        </div>
        
        {/* --- ADDED: Area Value and Unit Fields --- */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="mb-2 block">
              <Label htmlFor="areaValue">
                Área Total*
              </Label>
            </div>
            <TextInput
              id="areaValue"
              type="number"
              min="1"
              {...register('areaValue')}
            />
            {errors.areaValue && <p className="text-red-500 text-sm mt-1">{errors.areaValue.message}</p>}
          </div>
          <div>
            <div className="mb-2 block">
              <Label htmlFor="areaUnit">
                Unidad de Área*
              </Label>
            </div>
            <Select
              id="areaUnit"
              {...register('areaUnit')}
            >
              <option value="">Seleccione</option>
              <option value="m²">m²</option>
              <option value="ft²">ft²</option>
              <option value="acres">acres</option>
              <option value="hectares">hectáreas</option>
            </Select>
            {errors.areaUnit && <p className="text-red-500 text-sm mt-1">{errors.areaUnit.message}</p>}
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold mb-2">Detalles y Características</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="mb-2 block">
                <Label htmlFor="capacity">
                  Capacidad*
                </Label>
              </div>
              <TextInput id="capacity" type="number" min="1" {...register('capacity')} />
              {errors.capacity && <p className="text-red-500 text-sm mt-1">{errors.capacity.message}</p>}
            </div>
            <div>
              <div className="mb-2 block">
                <Label htmlFor="bedrooms">
                  Dormitorios*
                </Label>
              </div>
              <TextInput id="bedrooms" type="number" min="0" {...register('bedrooms')} />
              {errors.bedrooms && <p className="text-red-500 text-sm mt-1">{errors.bedrooms.message}</p>}
            </div>
            <div>
              <div className="mb-2 block">
                <Label htmlFor="bathrooms">
                  Baños*
                </Label>
              </div>
              <TextInput id="bathrooms" type="number" min="0" step="0.5" {...register('bathrooms')} />
              {errors.bathrooms && <p className="text-red-500 text-sm mt-1">{errors.bathrooms.message}</p>}
            </div>
          </div>
        </div>

        {/* This section remains largely the same, but with corrected field names for checkboxes */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold mb-2">Precio y Gastos</h3>
          <div>
            <div className="mb-2 block">
              <Label htmlFor="availableFrom">
                Disponible desde*
              </Label>
            </div>
            <TextInput
              id="availableFrom"
              type="date"
              {...register('availableFrom')}
            />
            {errors.availableFrom && <p className="text-red-500 text-sm mt-1">{errors.availableFrom.message}</p>}
          </div>
          <div className="mt-4">
            <div className="mb-2 block">
              <Label htmlFor="currency">
                Moneda
              </Label>
            </div>
            <Select id="currency" {...register('currency')}>
              <option value="USD">USD - Dólar estadounidense</option>
              <option value="UYU">UYU - Peso Uruguayo</option>
              <option value="BRL">BRL - Real Brasileño</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - Libra esterlina</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <div className="mb-2 block">
                <Label htmlFor="salePrice">
                  Precio de venta (opcional)
                </Label>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500">{currency}</span>
                <TextInput id="salePrice" type="number" min="0" {...register('salePrice')} className="pl-16" />
              </div>
              {errors.salePrice && <p className="text-red-500 text-sm mt-1">{errors.salePrice.message}</p>}
            </div>
            <div>
              <div className="mb-2 block">
                <Label htmlFor="rentPrice">
                  Precio de alquiler (opcional)
                </Label>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500">{currency}</span>
                <TextInput id="rentPrice" type="number" min="0" {...register('rentPrice')} className="pl-16" />
              </div>
              {errors.rentPrice && <p className="text-red-500 text-sm mt-1">{errors.rentPrice.message}</p>}
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-2 block">
              <Label htmlFor="description">Descripción</Label>
            </div>
            <Textarea id="description" {...register('description')} rows={4} placeholder="Añada una descripción detallada de la propiedad..." />
            {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>}
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6 space-y-4">
            <h3 className="text-lg font-semibold mb-4">Opciones Adicionales</h3>
            <div className="flex items-center">
                {/* --- CORRECTED: Use 'isPriceVisible' from schema --- */}
                <Checkbox id="isPriceVisible" {...register('isPriceVisible')} />
                <Label htmlFor="isPriceVisible" className="ml-2">Mostrar precio en la publicación</Label>
            </div>
            <div className="flex items-center">
                {/* --- CORRECTED: Use 'hasGarage' from schema --- */}
                <Checkbox id="hasGarage" {...register('hasGarage')} />
                <Label htmlFor="hasGarage" className="ml-2">Tiene garaje</Label>
            </div>
            {/* --- ADDED: Conditional input for garage spaces --- */}
            {hasGarage && (
              <div className="pl-6">
                <div className="mb-2 block">
                  <Label htmlFor="garageSpaces">Número de Plazas de Garaje*</Label>
                </div>
                <TextInput id="garageSpaces" type="number" min="0" {...register('garageSpaces')} />
                {errors.garageSpaces && <p className="text-red-500 text-sm mt-1">{errors.garageSpaces.message}</p>}
              </div>
            )}
            <div className="flex items-center">
                <Checkbox id="hasCommonExpenses" {...register('hasCommonExpenses')} />
                <Label htmlFor="hasCommonExpenses" className="ml-2">Tiene gastos comunes</Label>
            </div>
            {hasCommonExpenses && (
              <div className="pl-6">
                <div className="mb-2 block">
                  <Label htmlFor="commonExpensesAmount">Monto de gastos comunes ({currency})</Label>
                </div>
                <TextInput id="commonExpensesAmount" type="number" min="0" {...register('commonExpensesAmount')} />
                {errors.commonExpensesAmount && <p className="text-red-500 text-sm mt-1">{errors.commonExpensesAmount.message}</p>}
              </div>
            )}
            <div className="flex items-center">
                {/* --- CORRECTED: Use 'isWaterIncluded' from schema --- */}
                <Checkbox id="isWaterIncluded" {...register('isWaterIncluded')} />
                <Label htmlFor="isWaterIncluded" className="ml-2">Pago de agua incluido</Label>
            </div>
            <div className="flex items-center">
                {/* --- CORRECTED: Use 'isElectricityIncluded' from schema --- */}
                <Checkbox id="isElectricityIncluded" {...register('isElectricityIncluded')} />
                <Label htmlFor="isElectricityIncluded" className="ml-2">Pago de electricidad incluido</Label>
            </div>
            {/* --- ADDED: Field for pets --- */}
            <div className="flex items-center">
                <Checkbox id="arePetsAllowed" {...register('arePetsAllowed')} />
                <Label htmlFor="arePetsAllowed" className="ml-2">Se permiten mascotas</Label>
            </div>
        </div>
        
        <div className="flex justify-between pt-4">
          <Button color="alternative" onClick={onBack}>
            Atrás
          </Button>
          <Button type="submit">
            Siguiente
          </Button>
        </div>
      </div>
    </form>
  );
}