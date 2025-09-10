import React, { useEffect, useCallback, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { debounce } from 'lodash';
import { PropertyFormMap } from './PropertyFormMap';
import { PropertyFormData } from './AddPropertyForm';
import { Button, Label, TextInput } from 'flowbite-react';

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
            <div className="mb-2 block">
                <Label htmlFor="streetName">
                Calle*
                </Label>
            </div>
            <TextInput id="streetName"
            {...register('streetName')} 
            onChange={() => {setUserEditedAddress(true);}}
            placeholder="Nombre de calle" />
            {errors.streetName && <p className="text-red-500 text-sm mt-1">{errors.streetName.message}</p>}
          </div>
          <div>
            <div className="mb-2 block">
                <Label htmlFor="houseNumber">
                Número de casa*
                </Label>
            </div>
            <TextInput id="houseNumber" 
            {...register('houseNumber')} 
            onChange={() => {setUserEditedAddress(true);}} />
            {errors.houseNumber && <p className="text-red-500 text-sm mt-1">{errors.houseNumber.message}</p>}
          </div>
        </div>
        <div>
            <div className="mb-2 block">
                <Label htmlFor="neighborhood">
                Barrio
                </Label>
            </div>
            <TextInput id="neighborhood"
            {...register('neighborhood')}
            placeholder="Barrio" />
            {errors.neighborhood && <p className="text-red-500 text-sm mt-1">{errors.neighborhood.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="mb-2 block">
                <Label htmlFor="city">
                Ciudad*
                </Label>
            </div>
            <TextInput id="city"
            {...register('city')} 
            onChange={() => {setUserEditedAddress(true);}} />
            {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city.message}</p>}
          </div>
          <div>
            <div className="mb-2 block">
                <Label htmlFor="state">
                Estado/Provincia*
                </Label>
            </div>
            <TextInput id="state" 
            {...register('state')} 
            onChange={() => {setUserEditedAddress(true);}} />
            {errors.state && <p className="text-red-500 text-sm mt-1">{errors.state.message}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="mb-2 block">
                <Label htmlFor="zipCode">
                Código Postal*
                </Label>
            </div>
            <TextInput id="zipCode" 
            {...register('zipCode')} />
            {errors.zipCode && <p className="text-red-500 text-sm mt-1">{errors.zipCode.message}</p>}
          </div>
          <div>
            <div className="mb-2 block">
                <Label htmlFor="country">
                País*
                </Label>
            </div>
            <TextInput id="country"
            {...register('country')} />
            {errors.country && <p className="text-red-500 text-sm mt-1">{errors.country.message}</p>}
          </div>
        </div>
        <div>
          <div className="mb-2 block">
                <Label htmlFor="location">
                Ubicación en el mapa*
                </Label>
            </div>
          <div id="location" className="h-[300px] border border-gray-300 rounded-lg overflow-hidden">
            <PropertyFormMap
              location={location}
              onLocationChange={newLocation => setValue('location', newLocation, { shouldValidate: true })}/>
          </div>
          {errors.location && <p className="text-red-500 text-sm mt-1">{errors.location.message}</p>}
        </div>
        <div className="flex justify-end">
          <Button type="submit">
            Siguiente
          </Button>
        </div>
      </div>
    </form>;
}