import React, { useEffect, useCallback, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { debounce } from 'lodash';
import { PropertyFormMap } from './PropertyFormMap';
import { PropertyFormData } from '../../../pages/dashboard/AddPropertyForm';
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
    const [locationManuallySet, setLocationManuallySet] = useState(false);

    const geocodeAddress = useCallback(
        debounce(async (addressQuery: string) => {
            if (addressQuery.length < 10 || locationManuallySet) return;
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
        }, 500),
        [locationManuallySet, setValue]);

    useEffect(() => {
        const [streetName, houseNumber, city, state, country] = addressParts;
        
        // Ensure all required fields have values and are not just whitespace
        const isComplete = 
            streetName?.trim() && 
            houseNumber?.trim() && 
            city?.trim() && 
            state?.trim() && 
            country?.trim();

        if (isComplete && !locationManuallySet) {
            const fullAddress = [
                `${streetName.trim()} ${houseNumber.trim()}`,
                city.trim(),
                state.trim(),
                country.trim()
            ].filter(Boolean).join(', ');
            
            geocodeAddress(fullAddress);
        }
    }, [addressParts, geocodeAddress, locationManuallySet]);

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
                        {...register('streetName', {
                            onChange: () => setLocationManuallySet(false)
                        })}
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
                        {...register('houseNumber', {
                            onChange: () => setLocationManuallySet(false)
                        })} />
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
                        {...register('city', {
                            onChange: () => setLocationManuallySet(false)
                        })} />
                    {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city.message}</p>}
                </div>
                <div>
                    <div className="mb-2 block">
                        <Label htmlFor="state">
                            Estado/Provincia*
                        </Label>
                    </div>
                    <TextInput id="state"
                        {...register('state', {
                            onChange: () => setLocationManuallySet(false)
                        })} />
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
                        {...register('country', {
                            onChange: () => setLocationManuallySet(false)
                        })} />
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
                        onLocationChange={newLocation => {
                            setValue('location', newLocation, { shouldValidate: true });
                            setLocationManuallySet(true);
                        }} />
                </div>
                {errors.location && <p className="text-red-500 text-sm mt-1">{errors.location.message}</p>}
            </div>
            <div className="flex justify-end">
                <Button 
                id="next-step-button"
                type="submit">
                    Siguiente
                </Button>
            </div>
        </div>
    </form>;
}