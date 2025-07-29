// PropertyFormStep3.tsx - CORRECTED VERSION
import React, { useRef, useState, useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { Upload, Image as ImageIcon, X } from 'lucide-react';
import { PropertyFormData } from './AddPropertyForm';

interface PropertyFormStep3Props {
  onNext: () => void;
  onBack: () => void;
}

const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;

const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export function PropertyFormStep3({ onNext, onBack }: PropertyFormStep3Props) {
  // No need for trigger here, parent handles it.
  const { watch, setValue, formState: { errors } } = useFormContext<PropertyFormData>();
  const images = watch('images', []);
  const mainImage = watch('mainImageUrl');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);

  const processFiles = async (files: File[]) => {
    setUploadErrors([]);
    const validatedFiles: File[] = [];
    const errorMessages: string[] = [];

    for (const file of files) {
      try {
        const { width, height } = await getImageDimensions(file);
        if (width < MIN_WIDTH || height < MIN_HEIGHT) {
          errorMessages.push(`${file.name}: Las dimensiones (${width}x${height}) son menores a las requeridas (${MIN_WIDTH}x${MIN_HEIGHT}px).`);
          continue;
        }
        validatedFiles.push(file);
      } catch (err) {
        errorMessages.push(`No se pudieron leer las dimensiones de ${file.name}.`);
      }
    }

    if (errorMessages.length > 0) {
      setUploadErrors(errorMessages);
    }

    if (validatedFiles.length > 0) {
      const currentImages = watch('images', []);
      setValue('images', [...currentImages, ...validatedFiles], { shouldValidate: true });
      
      const currentMainImage = watch('mainImageUrl');
      if (!currentMainImage && (images.length + validatedFiles.length) > 0) {
         setValue('mainImageUrl', validatedFiles[0].name, { shouldValidate: true });
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeImage = (index: number) => {
    const removedImage = images[index];
    const newImages = images.filter((_, i) => i !== index);
    setValue('images', newImages, { shouldValidate: true });

    if (mainImage === removedImage.name) {
      if (newImages.length > 0) {
        setValue('mainImageUrl', newImages[0].name, { shouldValidate: true });
      }
    }
  };

  const setMainImage = (image: File) => {
    setValue('mainImageUrl', image.name, { shouldValidate: true });
  };

  // Use a state to manage previews and clean them up properly.
  const [previews, setPreviews] = useState<{[key: string]: string}>({});
  useEffect(() => {
    const newPreviews: {[key: string]: string} = {};
    images.forEach(image => {
      newPreviews[image.name] = URL.createObjectURL(image);
    });
    setPreviews(newPreviews);

    return () => {
      Object.values(newPreviews).forEach(url => URL.revokeObjectURL(url));
    }
  }, [images]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="space-y-6">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center" onDrop={handleDrop} onDragOver={handleDragOver}>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple accept="image/*" className="hidden" />
          <div className="flex flex-col items-center">
            <Upload size={40} className="text-gray-400 mb-4" />
            <p className="text-[#101828] font-medium mb-2">Arrastra y suelta las imágenes aquí (hasta 15)</p>
            <p className="text-gray-500 text-sm mb-4">o</p>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-[#62B6CB] text-[#FDFFFC] px-4 py-2 rounded-md hover:opacity-90 transition-colors">
              Seleccionar archivos
            </button>
          </div>
        </div>
        {errors.images && <p className="text-red-500 text-sm mt-1">{errors.images.message}</p>}
        {errors.mainImageUrl && !mainImage && <p className="text-red-500 text-sm mt-1">{errors.mainImageUrl.message}</p>}
        {uploadErrors.length > 0 && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mt-4" role="alert">
            <strong className="font-bold">Errores de subida:</strong>
            <ul className="list-disc list-inside mt-2">{uploadErrors.map((err, i) => <li key={i}>{err}</li>)}</ul>
          </div>
        )}
        
        {images.length > 0 && (
          <div>
            <h3 className="text-[#101828] font-medium mb-4">Imágenes seleccionadas ({images.length})</h3>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {images.map((image: File, index: number) => (
                <div key={image.name + index} className="relative group">
              <div className={`aspect-square rounded-lg overflow-hidden border-2 ${mainImage === image.name ? 'border-[#62B6CB]' : 'border-transparent'}`}>
                    <img src={previews[image.name]} alt={`Imagen ${index + 1}`} className="w-full h-full object-cover" />
              </div>
              <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                    <button type="button" onClick={() => setMainImage(image)} className="p-1.5 bg-white/90 rounded-full hover:scale-110" title="Establecer como imagen principal">
                      <ImageIcon size={18} className="text-[#101828]" />
                </button>
                    <button type="button" onClick={() => removeImage(index)} className="p-1.5 bg-white/90 rounded-full hover:scale-110" title="Eliminar imagen">
                      <X size={18} className="text-red-500" />
                </button>
              </div>
                  {mainImage === image.name && (
                    <span className="absolute top-2 left-2 bg-[#62B6CB] text-white text-xs px-2 py-1 rounded-full shadow-lg">
                Principal
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4">
          <button type="button" onClick={onBack} className="bg-gray-200 text-[#101828] px-6 py-2 rounded-md hover:bg-gray-300 transition-colors">
            Atrás
          </button>
          <button type="button" onClick={onNext} className="bg-[#1B4965] text-[#FDFFFC] px-6 py-2 rounded-md hover:opacity-90 transition-colors">
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}