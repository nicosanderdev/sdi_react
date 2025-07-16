import React, { useEffect, useCallback, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { debounce } from 'lodash';
import { PropertyFormMap } from './PropertyFormMap';
import { PropertyFormData } from './AddPropertyForm';

interface PropertyFormStep1Props {
  onNext: () => void;
}

export function PropertyFormStep1({
  onNext
}: PropertyFormStep1Props) {
  const { register, formState: { errors }, watch, setValue, trigger } = useFormContext<PropertyFormData>();
  const location = watch('location');
  const addressParts = watch(['streetName', 'houseNumber', 'city', 'state', 'country']);
  const [userEditedAddress, setUserEditedAddress] = useState(false);

   const geocodeAddress = useCallback(
  debounce(async (addressQuery: string) => {
    if (addressQuery.length < 10) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressQuery)}&limit=1`);
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        setValue('location', { lat: parseFloat(lat), lng: parseFloat(lon) }, { shouldValidate: true });
      }
    } catch (error) {
      console.error("Geocoding error:", error);
    }
  }, 1000),
  []);

  useEffect(() => {
    if (!userEditedAddress) return;

    const [streetName, houseNumber, city, state, country] = addressParts;
    if (streetName && houseNumber && city && state && country) {
      const fullAddress = [streetName, houseNumber, city, state, country].join(', ');
      geocodeAddress(fullAddress);
      setUserEditedAddress(false);
    }
  }, [addressParts, geocodeAddress, userEditedAddress]);

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    const fieldsToValidate: (keyof PropertyFormData)[] = ['streetName', 'houseNumber', 'neighborhood', 'city', 'state', 'zipCode', 'country', 'location'];
    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      onNext();
    }
  };

  return <form onSubmit={handleNext} className="max-w-2xl mx-auto">
      <div className="space-y-6">
        <div className='grid grid-cols-2 gap-4'>
          <div>
            <label className="block text-sm font-medium text-[#101828] mb-1">
              Calle*
            </label>
            <input type="text" {...register('streetName')} onChange={() => {setUserEditedAddress(true);}} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" placeholder="Nombre de calle" />
            {errors.streetName && <p className="text-red-500 text-sm mt-1">{errors.streetName.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#101828] mb-1">
              Número de casa*
            </label>
            <input type="text" {...register('houseNumber')} onChange={() => {setUserEditedAddress(true);}} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
            {errors.houseNumber && <p className="text-red-500 text-sm mt-1">{errors.houseNumber.message}</p>}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#101828] mb-1">
              Barrio
            </label>
            <input type="text" {...register('neighborhood')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" placeholder="Barrio" />
            {errors.neighborhood && <p className="text-red-500 text-sm mt-1">{errors.neighborhood.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#101828] mb-1">
              Ciudad*
            </label>
            <input type="text" {...register('city')} onChange={() => {setUserEditedAddress(true);}} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
            {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#101828] mb-1">
              Estado/Provincia*
            </label>
            <input type="text" {...register('state')} onChange={() => {setUserEditedAddress(true);}} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
            {errors.state && <p className="text-red-500 text-sm mt-1">{errors.state.message}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#101828] mb-1">
              Código Postal*
            </label>
            <input type="text" {...register('zipCode')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
            {errors.zipCode && <p className="text-red-500 text-sm mt-1">{errors.zipCode.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#101828] mb-1">
              País*
            </label>
            <input type="text" {...register('country')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
            {errors.country && <p className="text-red-500 text-sm mt-1">{errors.country.message}</p>}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#101828] mb-1">
            Ubicación en el mapa*
          </label>
          <div className="h-[300px] border border-gray-300 rounded-lg overflow-hidden">
            <PropertyFormMap
              location={location}
              onLocationChange={newLocation => setValue('location', newLocation, { shouldValidate: true })}
            />
          </div>
          {errors.location && <p className="text-red-500 text-sm mt-1">{errors.location.message}</p>}
        </div>
        <div className="flex justify-end">
          <button type="submit" className="bg-[#62B6CB] text-[#FDFFFC] px-6 py-2 rounded-md hover:opacity-90 transition-colors">
            Siguiente
          </button>
        </div>
      </div>
    </form>;
}