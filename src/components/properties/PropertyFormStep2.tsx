import React from 'react';
interface PropertyFormStep2Props {
  formData: any;
  updateFormData: (data: any) => void;
  onNext: () => void;
}
export function PropertyFormStep2({
  formData,
  updateFormData,
  onNext
}: PropertyFormStep2Props) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };
  return <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#101828] mb-1">
              Capacidad*
            </label>
            <input type="number" required min="1" value={formData.capacity} onChange={e => updateFormData({
            capacity: e.target.value
          })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#101828] mb-1">
              Dormitorios*
            </label>
            <input type="number" required min="0" value={formData.bedrooms} onChange={e => updateFormData({
            bedrooms: e.target.value
          })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#101828] mb-1">
              Baños*
            </label>
            <input type="number" required min="0" step="0.5" value={formData.bathrooms} onChange={e => updateFormData({
            bathrooms: e.target.value
          })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#101828] mb-1">
            Disponible desde*
          </label>
          <input type="date" required value={formData.availableFrom} onChange={e => updateFormData({
          availableFrom: e.target.value
        })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#101828] mb-1">
            Moneda
          </label>
          <select value={formData.currency} onChange={e => updateFormData({
          currency: e.target.value
        })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]">
            <option value="EUR">EUR - Euro</option>
            <option value="USD">USD - Dólar estadounidense</option>
            <option value="GBP">GBP - Libra esterlina</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#101828] mb-1">
              Precio de venta
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">
                {formData.currency}
              </span>
              <input type="number" min="0" value={formData.salePrice} onChange={e => updateFormData({
              salePrice: e.target.value
            })} className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#101828] mb-1">
              Precio de alquiler (por mes)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">
                {formData.currency}
              </span>
              <input type="number" min="0" value={formData.rentPrice} onChange={e => updateFormData({
              rentPrice: e.target.value
            })} className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" className="bg-[#62B6CB] text-[#FDFFFC] px-6 py-2 rounded-md hover:opacity-90 transition-colors">
            Siguiente
          </button>
        </div>
      </div>
    </form>;
}