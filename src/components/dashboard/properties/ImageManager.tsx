import React, { useRef, useMemo } from 'react';
import { Upload, Trash2, Star } from 'lucide-react';
import { Button } from 'flowbite-react';
import { resolveAssetUrl } from '../../../utils/resolveAssetUrl';
import { GLOBAL_MAX_PHOTOS_PER_PROPERTY, effectivePhotoCap } from '../../../utils/photoLimits';

export interface DisplayImage {
    key: string;
    previewUrl: string;
    alt: string;
    isMain: boolean;
    source: 'existing' | 'new';
    file?: File;
    id?: string;
}

interface ImageManagerProps {
    displayImages: DisplayImage[];
    onImagesChange: (images: DisplayImage[] | ((prev: DisplayImage[]) => DisplayImage[])) => void;
    /** Plan MaxPhotosPerProperty (null/undefined → global max). */
    maxPhotosPerProperty?: number | null;
}

export const ImageManager: React.FC<ImageManagerProps> = ({
    displayImages,
    onImagesChange,
    maxPhotosPerProperty
}) => {
    const imageFileInputRef = useRef<HTMLInputElement>(null);
    const maxPhotos = useMemo(
        () => effectivePhotoCap(maxPhotosPerProperty),
        [maxPhotosPerProperty]
    );
    const remainingSlots = Math.max(0, maxPhotos - displayImages.length);
    const isAtCap = remainingSlots <= 0;

    const handleProcessImages = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        if (isAtCap) {
            alert(`Has alcanzado el límite de ${maxPhotos} fotos por propiedad.`);
            return;
        }

        const newFiles = Array.from(files).slice(0, remainingSlots);
        if (newFiles.length < files.length) {
            alert(
                `Solo puedes agregar ${remainingSlots} foto(s) más (máximo ${maxPhotos} por propiedad).`
            );
        }

        const newDisplayImages: DisplayImage[] = newFiles.map(file => ({
            key: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
            previewUrl: URL.createObjectURL(file),
            alt: file.name,
            isMain: false,
            source: 'new',
            file: file
        }));

        onImagesChange((prev: DisplayImage[]) => {
            const updatedImages = [...prev, ...newDisplayImages];
            if (!updatedImages.some(img => img.isMain) && updatedImages.length > 0) {
                updatedImages[0].isMain = true;
            }
            return updatedImages;
        });
    };

    const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleProcessImages(e.target.files);
        e.target.value = '';
    };

    const handleImageDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (isAtCap) {
            alert(`Has alcanzado el límite de ${maxPhotos} fotos por propiedad.`);
            return;
        }
        handleProcessImages(e.dataTransfer.files);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();

    const handleDeleteImage = (key: string) => {
        const imageToDelete = displayImages.find(img => img.key === key);
        if (!imageToDelete) return;

        if (imageToDelete.source === 'new') {
            URL.revokeObjectURL(imageToDelete.previewUrl);
        }

        onImagesChange((prev: DisplayImage[]) => {
            const remaining = prev.filter((img: DisplayImage) => img.key !== key);
            if (imageToDelete.isMain && remaining.length > 0) {
                remaining[0].isMain = true;
            }
            return remaining;
        });
    };

    const handleSetMainImage = (key: string) => {
        onImagesChange((prev: DisplayImage[]) => prev.map((img: DisplayImage) => ({
            ...img,
            isMain: img.key === key
        })));
    };

    return (
        <div className='p-4 md:p-6'>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4 border-b pb-2">
                <h3 className="text-xl font-semibold">Imágenes</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    {displayImages.length}/{maxPhotos} fotos
                    {maxPhotos < GLOBAL_MAX_PHOTOS_PER_PROPERTY
                        ? ` (límite del plan; máximo global ${GLOBAL_MAX_PHOTOS_PER_PROPERTY})`
                        : ''}
                </p>
            </div>

            <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isAtCap
                        ? 'border-gray-200 cursor-not-allowed opacity-60'
                        : 'border-gray-300 cursor-pointer hover:border-primary-400'
                }`}
                onDrop={handleImageDrop}
                onDragOver={handleDragOver}
                onClick={() => {
                    if (!isAtCap) imageFileInputRef.current?.click();
                }}
            >
                <input
                    type="file"
                    ref={imageFileInputRef}
                    onChange={handleImageFileChange}
                    multiple
                    accept="image/*"
                    className="hidden"
                    disabled={isAtCap}
                />
                <div className="flex flex-col items-center">
                    <Upload size={40} className="text-gray-400 mb-4" />
                    {isAtCap ? (
                        <>
                            <p className="font-medium mb-2">Límite de fotos alcanzado</p>
                            <p className="text-sm mb-4">
                                Elimina alguna imagen para poder agregar otras (máximo {maxPhotos}).
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="font-medium mb-2">Arrastra y suelta las imágenes aquí</p>
                            <p className="text-sm mb-4">
                                Puedes agregar hasta {remainingSlots} más
                            </p>
                            <Button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    imageFileInputRef.current?.click();
                                }}
                            >
                                Seleccionar archivos
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {displayImages.length > 0 && (
                <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {displayImages.map((img) => (
                        <div key={img.key} className="relative group aspect-square">
                            <img
                                src={resolveAssetUrl(img.previewUrl)}
                                alt={img.alt}
                                className="w-full h-full object-cover rounded-lg"
                            />
                            <div className="absolute inset-0 bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-300 flex items-center justify-center gap-2 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => handleDeleteImage(img.key)}
                                    className="p-2 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300"
                                    title="Eliminar imagen"
                                >
                                    <Trash2 size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSetMainImage(img.key)}
                                    className={`p-2 rounded-full opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300 ${img.isMain ? 'bg-yellow-400 text-white' : 'bg-gray-700 text-white'
                                        }`}
                                    title="Marcar como principal"
                                >
                                    <Star size={18} />
                                </button>
                            </div>
                            {img.isMain && (
                                <div className="absolute top-2 right-2 bg-yellow-400 text-white rounded-full p-1" title="Imagen Principal">
                                    <Star size={14} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
