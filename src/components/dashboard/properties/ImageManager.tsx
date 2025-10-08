import React, { useRef, useEffect } from 'react';
import { Upload, Trash2, Star } from 'lucide-react';
import { Button } from 'flowbite-react';

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
}

export const ImageManager: React.FC<ImageManagerProps> = ({
    displayImages,
    onImagesChange
}) => {
    const imageFileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        return () => displayImages.forEach(img => {
            if (img.source === 'new') URL.revokeObjectURL(img.previewUrl);
        });
    }, [displayImages]);

    // --- Image Handlers ---
    const handleProcessImages = (files: FileList | null) => {
        if (!files) return;
        const newFiles = Array.from(files);
        const newDisplayImages: DisplayImage[] = newFiles.map(file => ({
            key: `${file.name}-${file.lastModified}`,
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

    const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) =>
        handleProcessImages(e.target.files);

    const handleImageDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
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
            <h3 className="text-xl font-semibold mb-4 border-b pb-2">Imágenes</h3>

            <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary-400 transition-colors"
                onDrop={handleImageDrop}
                onDragOver={handleDragOver}
                onClick={() => imageFileInputRef.current?.click()}
            >
                <input
                    type="file"
                    ref={imageFileInputRef}
                    onChange={handleImageFileChange}
                    multiple
                    accept="image/*"
                    className="hidden"
                />
                <div className="flex flex-col items-center">
                    <Upload size={40} className="text-gray-400 mb-4" />
                    <p className="font-medium mb-2">Arrastra y suelta las imágenes aquí</p>
                    <p className="text-sm mb-4">o</p>
                    <Button
                        onClick={(e) => { e.stopPropagation(); imageFileInputRef.current?.click(); }}
                    >
                        Seleccionar archivos
                    </Button>
                </div>
            </div>

            {displayImages.length > 0 && (
                <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {displayImages.map((img) => (
                        <div key={img.key} className="relative group aspect-square">
                            <img
                                src={img.previewUrl}
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