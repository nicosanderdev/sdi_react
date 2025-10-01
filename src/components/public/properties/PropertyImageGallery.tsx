import React, { useState, useEffect } from 'react';

interface Image {
  id: string;
  url: string;
}

interface Props {
  images: Image[];
  mainImageId: string;
}

function PropertyImageGallery({ images, mainImageId }: Props) {
  const [selectedImage, setSelectedImage] = useState<Image | undefined>();

  useEffect(() => {
    const mainImage = images.find(img => img.id === mainImageId) || images[0];
    setSelectedImage(mainImage);
  }, [images, mainImageId]);

  if (!images || images.length === 0) {
    return <div className="bg-gray-200 aspect-video w-full flex items-center justify-center text-gray-500">No Image Available</div>;
  }

  return (
    <div>
      {/* Big Selected Photo */}
      <div className="aspect-w-16 aspect-h-9 mb-4">
        <img
          src={selectedImage?.url}
          alt="Selected property view"
          className="w-full h-full object-cover rounded-lg shadow-lg"
        />
      </div>

      {/* Photo Carousel/Thumbnails */}
      <div className="flex space-x-2 overflow-x-auto pb-2">
        {images.map((image) => (
          <button
            key={image.id}
            onClick={() => setSelectedImage(image)}
            className={`flex-shrink-0 w-24 h-24 rounded-md overflow-hidden transition-all duration-200 ${
              selectedImage?.id === image.id ? 'ring-4 ring-blue-500' : 'ring-2 ring-transparent hover:ring-blue-300'
            }`}
          >
            <img
              src={image.url}
              alt={`Property thumbnail ${image.id}`}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export default PropertyImageGallery;