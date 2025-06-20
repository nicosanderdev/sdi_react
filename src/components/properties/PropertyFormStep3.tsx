import React, { useRef } from 'react';
import { Upload, Image as ImageIcon, X } from 'lucide-react';
interface PropertyFormStep3Props {
  formData: any;
  updateFormData: (data: any) => void;
  onSubmit: () => void;
}
export function PropertyFormStep3({
  formData,
  updateFormData,
  onSubmit
}: PropertyFormStep3Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newImages = Array.from(e.target.files);
      updateFormData({
        images: [...formData.images, ...newImages]
      });
    }
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const newImages = Array.from(e.dataTransfer.files);
      updateFormData({
        images: [...formData.images, ...newImages]
      });
    }
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  const removeImage = (index: number) => {
    const newImages = formData.images.filter((_: any, i: number) => i !== index);
    updateFormData({
      images: newImages,
      mainImage: formData.mainImage === formData.images[index] ? null : formData.mainImage
    });
  };
  const setMainImage = (image: File) => {
    updateFormData({
      mainImage: image
    });
  };
  return <div className="max-w-2xl mx-auto">
      <div className="space-y-6">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center" onDrop={handleDrop} onDragOver={handleDragOver}>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple accept="image/*" className="hidden" />
          <div className="flex flex-col items-center">
            <Upload size={40} className="text-gray-400 mb-4" />
            <p className="text-[#101828] font-medium mb-2">
              Arrastra y suelta las imágenes aquí
            </p>
            <p className="text-gray-500 text-sm mb-4">o</p>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-[#62B6CB] text-[#FDFFFC] px-4 py-2 rounded-md hover:opacity-90 transition-colors">
              Seleccionar archivos
            </button>
          </div>
        </div>
        {formData.images.length > 0 && <div>
            <h3 className="text-[#101828] font-medium mb-4">
              Imágenes seleccionadas ({formData.images.length})
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {formData.images.map((image: File, index: number) => <div key={index} className="relative group">
                  <div className={`aspect-square rounded-lg overflow-hidden border-2 ${formData.mainImage === image ? 'border-[#62B6CB]' : 'border-transparent'}`}>
                    <img src={URL.createObjectURL(image)} alt={`Imagen ${index + 1}`} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                    <button type="button" onClick={() => setMainImage(image)} className="p-1 bg-[#FDFFFC] rounded-full hover:bg-gray-100" title="Establecer como imagen principal">
                      <ImageIcon size={16} className="text-[#101828]" />
                    </button>
                    <button type="button" onClick={() => removeImage(index)} className="p-1 bg-[#FDFFFC] rounded-full hover:bg-gray-100" title="Eliminar imagen">
                      <X size={16} className="text-red-500" />
                    </button>
                  </div>
                  {formData.mainImage === image && <span className="absolute top-2 left-2 bg-[#62B6CB] text-[#FDFFFC] text-xs px-2 py-1 rounded-full">
                      Principal
                    </span>}
                </div>)}
            </div>
          </div>}
        <div className="flex justify-end">
          <button type="button" onClick={onSubmit} disabled={formData.images.length === 0 || !formData.mainImage} className="bg-[#62B6CB] text-[#FDFFFC] px-6 py-2 rounded-md hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            Guardar Propiedad
          </button>
        </div>
      </div>
    </div>;
}