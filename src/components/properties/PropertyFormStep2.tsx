import React from 'react';
import { useFormContext } from 'react-hook-form';
import { PropertyFormData } from './AddPropertyForm';

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
          <h3 className="text-lg font-semibold text-[#101828] mb-2">Información Principal</h3>
          {/* --- ADDED: Title Field --- */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-[#101828] mb-1">
              Título de la Publicación*
            </label>
            <input
              id="title"
              type="text"
              {...register('title')}
              placeholder="Ej: Apartamento moderno en el centro"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]"
            />
            {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>}
          </div>
        </div>

        {/* --- ADDED: Grid container for Type, Status, Area --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* --- ADDED: Property Type Field --- */}
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-[#101828] mb-1">
              Tipo de Propiedad*
            </label>
            <select
              id="type"
              {...register('type')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]"
            >
              <option value="">Seleccione un tipo</option>
              <option value="apartment">Apartamento</option>
              <option value="house">Casa</option>
              <option value="commercial">Comercial</option>
              <option value="land">Terreno</option>
              <option value="other">Otro</option>
            </select>
            {errors.type && <p className="text-red-500 text-sm mt-1">{errors.type.message}</p>}
          </div>

          {/* --- ADDED: Status Field --- */}
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-[#101828] mb-1">
              Estado*
            </label>
            <select
              id="status"
              {...register('status')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]"
            >
              <option value="">Seleccione un estado</option>
              <option value="sale">En Venta</option>
              <option value="rent">En Alquiler</option>
              <option value="reserved">Reservado</option>
              <option value="sold">Vendido</option>
              <option value="unavailable">No Disponible</option>
            </select>
            {errors.status && <p className="text-red-500 text-sm mt-1">{errors.status.message}</p>}
          </div>
        </div>
        
        {/* --- ADDED: Area Value and Unit Fields --- */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="areaValue" className="block text-sm font-medium text-[#101828] mb-1">
              Área Total*
            </label>
            <input
              id="areaValue"
              type="number"
              min="1"
              {...register('areaValue')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]"
            />
            {errors.areaValue && <p className="text-red-500 text-sm mt-1">{errors.areaValue.message}</p>}
          </div>
          <div>
            <label htmlFor="areaUnit" className="block text-sm font-medium text-[#101828] mb-1">
              Unidad de Área*
            </label>
            <select
              id="areaUnit"
              {...register('areaUnit')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]"
            >
              <option value="">Seleccione</option>
              <option value="m²">m²</option>
              <option value="ft²">ft²</option>
              <option value="acres">acres</option>
              <option value="hectares">hectáreas</option>
            </select>
            {errors.areaUnit && <p className="text-red-500 text-sm mt-1">{errors.areaUnit.message}</p>}
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-[#101828] mb-2">Detalles y Características</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="capacity" className="block text-sm font-medium text-[#101828] mb-1">
                Capacidad*
              </label>
              <input id="capacity" type="number" min="1" {...register('capacity')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
              {errors.capacity && <p className="text-red-500 text-sm mt-1">{errors.capacity.message}</p>}
            </div>
            <div>
              <label htmlFor="bedrooms" className="block text-sm font-medium text-[#101828] mb-1">
                Dormitorios*
              </label>
              <input id="bedrooms" type="number" min="0" {...register('bedrooms')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
              {errors.bedrooms && <p className="text-red-500 text-sm mt-1">{errors.bedrooms.message}</p>}
            </div>
            <div>
              <label htmlFor="bathrooms" className="block text-sm font-medium text-[#101828] mb-1">
                Baños*
              </label>
              <input id="bathrooms" type="number" min="0" step="0.5" {...register('bathrooms')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
              {errors.bathrooms && <p className="text-red-500 text-sm mt-1">{errors.bathrooms.message}</p>}
            </div>
          </div>
        </div>

        {/* This section remains largely the same, but with corrected field names for checkboxes */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-[#101828] mb-2">Precio y Gastos</h3>
          <div>
            <label htmlFor="availableFrom" className="block text-sm font-medium text-[#101828] mb-1">
              Disponible desde*
            </label>
            <input id="availableFrom" type="date" {...register('availableFrom')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
            {errors.availableFrom && <p className="text-red-500 text-sm mt-1">{errors.availableFrom.message}</p>}
          </div>
          <div className="mt-4">
            <label htmlFor="currency" className="block text-sm font-medium text-[#101828] mb-1">
              Moneda
            </label>
            <select id="currency" {...register('currency')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]">
              <option value="USD">USD - Dólar estadounidense</option>
              <option value="UYU">UYU - Peso Uruguayo</option>
              <option value="BRL">BRL - Real Brasileño</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - Libra esterlina</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label htmlFor="salePrice" className="block text-sm font-medium text-[#101828] mb-1">
                Precio de venta (opcional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500">{currency}</span>
                <input id="salePrice" type="number" min="0" {...register('salePrice')} className="w-full pl-16 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
              </div>
              {errors.salePrice && <p className="text-red-500 text-sm mt-1">{errors.salePrice.message}</p>}
            </div>
            <div>
              <label htmlFor="rentPrice" className="block text-sm font-medium text-[#101828] mb-1">
                Precio de alquiler (opcional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500">{currency}</span>
                <input id="rentPrice" type="number" min="0" {...register('rentPrice')} className="w-full pl-16 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
              </div>
              {errors.rentPrice && <p className="text-red-500 text-sm mt-1">{errors.rentPrice.message}</p>}
            </div>
          </div>
          <div className="mt-4">
            <label htmlFor="description" className="block text-sm font-medium text-[#101828] mb-1">Descripción</label>
            <textarea id="description" {...register('description')} rows={4} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" placeholder="Añada una descripción detallada de la propiedad..." />
            {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>}
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6 space-y-4">
            <h3 className="text-lg font-semibold text-[#101828] mb-2">Opciones Adicionales</h3>
            <div className="flex items-center">
                {/* --- CORRECTED: Use 'isPriceVisible' from schema --- */}
                <input type="checkbox" id="isPriceVisible" {...register('isPriceVisible')} className="h-4 w-4 text-[#62B6CB] border-gray-300 rounded focus:ring-[#62B6CB]" />
                <label htmlFor="isPriceVisible" className="ml-2 text-sm text-[#101828]">Mostrar precio en la publicación</label>
            </div>
            <div className="flex items-center">
                {/* --- CORRECTED: Use 'hasGarage' from schema --- */}
                <input type="checkbox" id="hasGarage" {...register('hasGarage')} className="h-4 w-4 text-[#62B6CB] border-gray-300 rounded focus:ring-[#62B6CB]" />
                <label htmlFor="hasGarage" className="ml-2 text-sm text-[#101828]">Tiene garaje</label>
            </div>
            {/* --- ADDED: Conditional input for garage spaces --- */}
            {hasGarage && (
              <div className="pl-6">
                <label htmlFor="garageSpaces" className="block text-sm font-medium text-[#101828] mb-1">Número de Plazas de Garaje*</label>
                <input id="garageSpaces" type="number" min="0" {...register('garageSpaces')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
                {errors.garageSpaces && <p className="text-red-500 text-sm mt-1">{errors.garageSpaces.message}</p>}
              </div>
            )}
            <div className="flex items-center">
                <input type="checkbox" id="hasCommonExpenses" {...register('hasCommonExpenses')} className="h-4 w-4 text-[#62B6CB] border-gray-300 rounded focus:ring-[#62B6CB]" />
                <label htmlFor="hasCommonExpenses" className="ml-2 text-sm text-[#101828]">Tiene gastos comunes</label>
            </div>
            {hasCommonExpenses && (
              <div className="pl-6">
                <label className="block text-sm font-medium text-[#101828] mb-1">Monto de gastos comunes ({currency})</label>
                <input type="number" min="0" {...register('commonExpensesAmount')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
                {errors.commonExpensesAmount && <p className="text-red-500 text-sm mt-1">{errors.commonExpensesAmount.message}</p>}
              </div>
            )}
            <div className="flex items-center">
                {/* --- CORRECTED: Use 'isWaterIncluded' from schema --- */}
                <input type="checkbox" id="isWaterIncluded" {...register('isWaterIncluded')} className="h-4 w-4 text-[#62B6CB] border-gray-300 rounded focus:ring-[#62B6CB]" />
                <label htmlFor="isWaterIncluded" className="ml-2 text-sm text-[#101828]">Pago de agua incluido</label>
            </div>
            <div className="flex items-center">
                {/* --- CORRECTED: Use 'isElectricityIncluded' from schema --- */}
                <input type="checkbox" id="isElectricityIncluded" {...register('isElectricityIncluded')} className="h-4 w-4 text-[#62B6CB] border-gray-300 rounded focus:ring-[#62B6CB]" />
                <label htmlFor="isElectricityIncluded" className="ml-2 text-sm text-[#101828]">Pago de electricidad incluido</label>
            </div>
            {/* --- ADDED: Field for pets --- */}
            <div className="flex items-center">
                <input type="checkbox" id="arePetsAllowed" {...register('arePetsAllowed')} className="h-4 w-4 text-[#62B6CB] border-gray-300 rounded focus:ring-[#62B6CB]" />
                <label htmlFor="arePetsAllowed" className="ml-2 text-sm text-[#101828]">Se permiten mascotas</label>
            </div>
        </div>
        
        <div className="flex justify-between pt-4">
          <button type="button" onClick={onBack} className="bg-gray-200 text-[#101828] px-6 py-2 rounded-md hover:bg-gray-300 transition-colors">
            Atrás
          </button>
          <button type="submit" className="bg-[#1B4965] text-[#FDFFFC] px-6 py-2 rounded-md hover:opacity-90 transition-colors">
            Siguiente
          </button>
        </div>
      </div>
    </form>
  );
}