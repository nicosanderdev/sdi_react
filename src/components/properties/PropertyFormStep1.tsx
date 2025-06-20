import React from 'react';
import { PropertyFormMap } from './PropertyFormMap';
interface PropertyFormStep1Props {
  formData: any;
  updateFormData: (data: any) => void;
  onNext: () => void;
}
export function PropertyFormStep1({
  formData,
  updateFormData,
  onNext
}: PropertyFormStep1Props) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };
  return <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-[#101828] mb-1">
            Dirección*
          </label>
          <input type="text" required value={formData.address} onChange={e => updateFormData({
          address: e.target.value
        })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" placeholder="Calle y número" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#101828] mb-1">
            Dirección (línea 2)
          </label>
          <input type="text" value={formData.address2} onChange={e => updateFormData({
          address2: e.target.value
        })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" placeholder="Apartamento, suite, unidad, etc." />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#101828] mb-1">
              Ciudad*
            </label>
            <input type="text" required value={formData.city} onChange={e => updateFormData({
            city: e.target.value
          })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#101828] mb-1">
              Estado/Provincia*
            </label>
            <input type="text" required value={formData.state} onChange={e => updateFormData({
            state: e.target.value
          })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#101828] mb-1">
              Código Postal*
            </label>
            <input type="text" required value={formData.zipCode} onChange={e => updateFormData({
            zipCode: e.target.value
          })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#101828] mb-1">
              País*
            </label>
            <input type="text" required value={formData.country} onChange={e => updateFormData({
            country: e.target.value
          })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#101828] mb-1">
            Ubicación en el mapa*
          </label>
          <div className="h-[300px] border border-gray-300 rounded-lg overflow-hidden">
            <PropertyFormMap location={formData.location} onLocationChange={location => updateFormData({
            location
          })} />
          </div>
        </div>
        <div className="flex items-center">
          <input type="checkbox" id="isPublished" checked={formData.isPublished} onChange={e => updateFormData({
          isPublished: e.target.checked
        })} className="h-4 w-4 text-[#62B6CB] border-gray-300 rounded focus:ring-[#62B6CB]" />
          <label htmlFor="isPublished" className="ml-2 text-sm text-[#101828]">
            Publicar inmediatamente
          </label>
        </div>
        <div className="flex justify-end">
          <button type="submit" className="bg-[#62B6CB] text-[#FDFFFC] px-6 py-2 rounded-md hover:opacity-90 transition-colors">
            Siguiente
          </button>
        </div>
      </div>
    </form>;
}