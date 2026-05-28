import { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Label, Modal, ModalBody, ModalHeader, Select, TextInput, Textarea } from 'flowbite-react';
import propertyService from '../../../services/PropertyService';
import type { ListingType } from '../../../models/properties/PropertyData';
import { usesDynamicListingPricing } from '../../../models/properties/PropertyFormSchema';

interface EditListingModalProps {
  isOpen: boolean;
  propertyId: string | null;
  onClose: () => void;
  onSaved?: () => void;
}

type ListingFormState = {
  listingType: ListingType;
  title: string;
  description: string;
  availableFrom: string;
  currency: 'USD' | 'UYU' | 'BRL' | 'EUR' | 'GBP';
  salePrice: string;
  rentPrice: string;
  basePrice: string;
  minPrice: string;
  maxPrice: string;
  longStayDiscountEnabled: boolean;
  longStayMinDays: string;
  longStayDiscountPercentage: string;
  rentPricePeriod: 'PerNight' | 'PerMonth';
  isPriceVisible: boolean;
  isActive: boolean;
  isPropertyVisible: boolean;
  blockedForBooking: boolean;
};

const emptyForm: ListingFormState = {
  listingType: 'RealEstate',
  title: '',
  description: '',
  availableFrom: '',
  currency: 'USD',
  salePrice: '',
  rentPrice: '',
  basePrice: '',
  minPrice: '',
  maxPrice: '',
  longStayDiscountEnabled: false,
  longStayMinDays: '',
  longStayDiscountPercentage: '',
  rentPricePeriod: 'PerNight',
  isPriceVisible: true,
  isActive: true,
  isPropertyVisible: true,
  blockedForBooking: false,
};

export function EditListingModal({ isOpen, propertyId, onClose, onSaved }: EditListingModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ListingFormState>(emptyForm);
  const [initialSnapshot, setInitialSnapshot] = useState<string>('');

  const isSaleListing = form.listingType === 'RealEstate';
  const isDynamicPricing = usesDynamicListingPricing(form.listingType);
  const currentSnapshot = useMemo(() => JSON.stringify(form), [form]);
  const isDirty = initialSnapshot.length > 0 && currentSnapshot !== initialSnapshot;

  useEffect(() => {
    if (!isOpen || !propertyId) return;

    const loadListing = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const listing = await propertyService.getFeaturedListingForProperty(propertyId);
        if (!listing) {
          setForm(emptyForm);
          setInitialSnapshot(JSON.stringify(emptyForm));
          return;
        }

        const nextState: ListingFormState = {
          listingType: listing.listingType,
          title: listing.title ?? '',
          description: listing.description ?? '',
          availableFrom: listing.availableFrom ? listing.availableFrom.slice(0, 10) : '',
          currency: listing.currency,
          salePrice: listing.salePrice ?? '',
          rentPrice: listing.rentPrice ?? '',
          basePrice: listing.basePrice ?? '',
          minPrice: listing.minPrice ?? '',
          maxPrice: listing.maxPrice ?? '',
          longStayDiscountEnabled: listing.longStayDiscountEnabled ?? false,
          longStayMinDays:
            listing.longStayMinDays != null ? String(listing.longStayMinDays) : '',
          longStayDiscountPercentage:
            listing.longStayDiscountPercentage != null
              ? String(listing.longStayDiscountPercentage)
              : '',
          rentPricePeriod: listing.rentPricePeriod ?? 'PerNight',
          isPriceVisible: listing.isPriceVisible,
          isActive: listing.isActive,
          isPropertyVisible: listing.isPropertyVisible,
          blockedForBooking: listing.blockedForBooking,
        };

        setForm(nextState);
        setInitialSnapshot(JSON.stringify(nextState));
      } catch (e: any) {
        setError(e.message || 'No se pudo cargar el aviso actual.');
      } finally {
        setIsLoading(false);
      }
    };

    void loadListing();
  }, [isOpen, propertyId]);

  const setField = <K extends keyof ListingFormState>(key: K, value: ListingFormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!propertyId || !isDirty) return;
    try {
      setIsSaving(true);
      setError(null);
      await propertyService.createListingVersion(propertyId, {
        listingType: form.listingType,
        title: form.title,
        description: form.description,
        availableFrom: form.availableFrom || null,
        currency: form.currency,
        salePrice: isSaleListing ? form.salePrice || null : null,
        rentPrice: isSaleListing || isDynamicPricing ? null : form.rentPrice || null,
        basePrice: isDynamicPricing ? form.basePrice || null : null,
        minPrice: isDynamicPricing ? form.minPrice || null : null,
        maxPrice: isDynamicPricing ? form.maxPrice || null : null,
        longStayDiscountEnabled: isDynamicPricing ? form.longStayDiscountEnabled : false,
        longStayMinDays:
          isDynamicPricing && form.longStayDiscountEnabled && form.longStayMinDays
            ? parseInt(form.longStayMinDays, 10)
            : null,
        longStayDiscountPercentage:
          isDynamicPricing && form.longStayDiscountEnabled && form.longStayDiscountPercentage
            ? parseFloat(form.longStayDiscountPercentage)
            : null,
        rentPricePeriod: isSaleListing ? null : isDynamicPricing ? 'PerNight' : form.rentPricePeriod,
        isPriceVisible: form.isPriceVisible,
        isActive: form.isActive,
        isPropertyVisible: form.isPropertyVisible,
        blockedForBooking: form.blockedForBooking,
      });
      onSaved?.();
      onClose();
    } catch (e: any) {
      setError(e.message || 'No se pudo guardar la nueva version del aviso.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal show={isOpen} onClose={onClose}>
      <ModalHeader>Editar aviso</ModalHeader>
      <ModalBody>
        {error && <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {isLoading ? (
          <p className="text-sm text-gray-500">Cargando informacion del aviso...</p>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="listingType">Tipo de aviso</Label>
              <Select id="listingType" value={form.listingType} onChange={e => setField('listingType', e.target.value as ListingType)}>
                <option value="RealEstate">Venta</option>
                <option value="AnnualRent">Alquiler anual</option>
                <option value="SummerRent">Alquiler temporario</option>
                <option value="EventVenue">Eventos</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="listingTitle">Titulo</Label>
              <TextInput id="listingTitle" value={form.title} onChange={e => setField('title', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="listingDescription">Descripcion</Label>
              <Textarea id="listingDescription" rows={3} value={form.description} onChange={e => setField('description', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="availableFrom">Disponible desde</Label>
                <TextInput id="availableFrom" type="date" value={form.availableFrom} onChange={e => setField('availableFrom', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="currency">Moneda</Label>
                <Select id="currency" value={form.currency} onChange={e => setField('currency', e.target.value as ListingFormState['currency'])}>
                  <option value="USD">USD</option>
                  <option value="UYU">UYU</option>
                  <option value="BRL">BRL</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </Select>
              </div>
            </div>
            {isSaleListing ? (
              <div>
                <Label htmlFor="salePrice">Precio de venta</Label>
                <TextInput id="salePrice" type="number" value={form.salePrice} onChange={e => setField('salePrice', e.target.value)} />
              </div>
            ) : isDynamicPricing ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="basePrice">Precio base</Label>
                    <TextInput id="basePrice" type="number" value={form.basePrice} onChange={e => setField('basePrice', e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="minPrice">Mínimo</Label>
                    <TextInput id="minPrice" type="number" value={form.minPrice} onChange={e => setField('minPrice', e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="maxPrice">Máximo</Label>
                    <TextInput id="maxPrice" type="number" value={form.maxPrice} onChange={e => setField('maxPrice', e.target.value)} />
                  </div>
                </div>
                <Label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.longStayDiscountEnabled}
                    onChange={e => setField('longStayDiscountEnabled', e.target.checked)}
                  />
                  Descuento por estadía larga
                </Label>
                {form.longStayDiscountEnabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="longStayMinDays">Mínimo de noches</Label>
                      <TextInput
                        id="longStayMinDays"
                        type="number"
                        value={form.longStayMinDays}
                        onChange={e => setField('longStayMinDays', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="longStayDiscountPercentage">Descuento (%)</Label>
                      <TextInput
                        id="longStayDiscountPercentage"
                        type="number"
                        value={form.longStayDiscountPercentage}
                        onChange={e => setField('longStayDiscountPercentage', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="rentPrice">Precio de alquiler</Label>
                  <TextInput id="rentPrice" type="number" value={form.rentPrice} onChange={e => setField('rentPrice', e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="rentPeriod">Periodo</Label>
                  <Select id="rentPeriod" value={form.rentPricePeriod} onChange={e => setField('rentPricePeriod', e.target.value as 'PerNight' | 'PerMonth')}>
                    <option value="PerNight">Por noche</option>
                    <option value="PerMonth">Por mes</option>
                  </Select>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Label className="flex items-center gap-2"><Checkbox checked={form.isPriceVisible} onChange={e => setField('isPriceVisible', e.target.checked)} />Mostrar precio</Label>
              <Label className="flex items-center gap-2"><Checkbox checked={form.isPropertyVisible} onChange={e => setField('isPropertyVisible', e.target.checked)} />Visible al publico</Label>
              <Label className="flex items-center gap-2"><Checkbox checked={form.isActive} onChange={e => setField('isActive', e.target.checked)} />Activo</Label>
              <Label className="flex items-center gap-2"><Checkbox checked={form.blockedForBooking} onChange={e => setField('blockedForBooking', e.target.checked)} />Bloqueado para reservas</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button color="alternative" onClick={onClose} disabled={isSaving}>Cancelar</Button>
              <Button onClick={handleSave} disabled={isSaving || !isDirty}>{isSaving ? 'Guardando...' : 'Guardar'}</Button>
            </div>
          </div>
        )}
      </ModalBody>
    </Modal>
  );
}

