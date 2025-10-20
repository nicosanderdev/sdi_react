import React, { useState, useEffect } from 'react';
import { PropertyImage } from '../../../models/properties';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_FILES_URL || '';

interface Props {
  images: PropertyImage[];
  mainImageId: string;
}

function PropertyImageGallery({ images, mainImageId }: Props) {
  const [selectedImage, setSelectedImage] = useState<PropertyImage | undefined>();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const mainImage = images.find(img => img.id === mainImageId) || images[0];
    setSelectedImage(mainImage);
    const mainIndex = images.findIndex(img => img.id === mainImageId);
    setCurrentIndex(mainIndex >= 0 ? mainIndex : 0);
  }, [images, mainImageId]);

  const nextImage = () => {
    const nextIndex = (currentIndex + 1) % images.length;
    setCurrentIndex(nextIndex);
    setSelectedImage(images[nextIndex]);
  };

  const prevImage = () => {
    const prevIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
    setCurrentIndex(prevIndex);
    setSelectedImage(images[prevIndex]);
  };

  const selectImage = (image: PropertyImage, index: number) => {
    setSelectedImage(image);
    setCurrentIndex(index);
  };

  if (!images || images.length === 0) {
    return <div className="bg-gray-200 aspect-video w-full flex items-center justify-center text-gray-500 rounded-lg">No Image Available</div>;
  }

  return (
    <div className="relative">
      {/* Main Image Display with Navigation */}
      <div className="relative aspect-video mb-4 rounded-lg overflow-hidden shadow-lg">
        <img
          src={`${API_BASE_URL}${selectedImage?.url?.startsWith('/') ? '' : '/'}${selectedImage?.url}`}
          alt="Selected property view"
          className="w-full h-full object-cover"
        />
        
        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full p-2 transition-all duration-200"
              aria-label="Previous image"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full p-2 transition-all duration-200"
              aria-label="Next image"
            >
              <ChevronRight size={24} />
            </button>
          </>
        )}

        {/* Image Counter */}
        {images.length > 1 && (
          <div className="absolute bottom-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
            {currentIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Thumbnail Carousel */}
      {images.length > 1 && (
        <div className="flex space-x-2 overflow-x-auto p-3 scrollbar-hide">
          {images.map((image, index) => (
            <button
              key={image.id}
              onClick={() => selectImage(image, index)}
              className={`flex-shrink-0 w-20 h-20 rounded-md overflow-hidden transition-all duration-200 ${
                selectedImage?.id === image.id 
                  ? 'ring-4 ring-blue-500 scale-105' 
                  : 'ring-2 ring-transparent hover:ring-blue-300 hover:scale-105'
              }`}
            >
              <img
                src={`${API_BASE_URL}${image.url?.startsWith('/') ? '' : '/'}${image.url}`}
                alt={`Property thumbnail ${image.id}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default PropertyImageGallery;