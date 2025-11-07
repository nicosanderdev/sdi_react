import React from 'react';
import { PropertyVideo } from '../../../models/properties';
import { Play, ExternalLink } from 'lucide-react';
import { Card } from 'flowbite-react';

interface Props {
  videos?: PropertyVideo[];
}

function PropertyVideoSection({ videos }: Props) {
  const generateThumbnailFromUrl = (url: string): string => {
    // For YouTube videos
    if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
      let videoId = '';
      if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1].split('?')[0].split('/')[0];
      } else if (url.includes('youtube.com/watch')) {
        const match = url.match(/[?&]v=([^&]+)/);
        videoId = match ? match[1] : '';
      }
      
      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      }
    }
    // For Vimeo videos
    if (url.includes('vimeo.com/')) {
      const videoId = url.split('vimeo.com/')[1].split('?')[0];
      return `https://vumbnail.com/${videoId}.jpg`;
    }
    return '';
  };

  const handleOpenVideoInNewTab = (url: string) => {
    if (url && url.trim()) {
      const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
      window.open(fullUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const isValidUrl = (url: string): boolean => {
    if (!url || !url.trim()) return false;
    try {
      const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
      new URL(fullUrl);
      return true;
    } catch {
      return false;
    }
  };

  // Filter only public videos
  const publicVideos = videos?.filter(video => video.isPublic !== false && video.url) || [];

  if (!publicVideos || publicVideos.length === 0) {
    return null;
  }

  return (
    <Card className="mb-8 p-3">
      <h2 className="text-2xl font-bold mb-6">Property Videos</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {publicVideos.map((video) => (
          <div key={video.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden group">
            {/* Video Thumbnail */}
            <div className="relative aspect-video bg-gray-100 dark:bg-gray-700">
              {video.url && generateThumbnailFromUrl(video.url) ? (
                <img
                  src={generateThumbnailFromUrl(video.url)}
                  alt={video.title || 'Video thumbnail'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.parentElement?.querySelector('.thumbnail-fallback') as HTMLElement;
                    if (fallback) {
                      fallback.classList.remove('hidden');
                    }
                  }}
                  onLoad={(e) => {
                    const target = e.target as HTMLImageElement;
                    const fallback = target.parentElement?.querySelector('.thumbnail-fallback') as HTMLElement;
                    if (fallback) {
                      fallback.classList.add('hidden');
                    }
                  }}
                />
              ) : null}
              
              {/* Fallback when no thumbnail */}
              <div className={`thumbnail-fallback absolute inset-0 flex items-center justify-center ${video.url && generateThumbnailFromUrl(video.url) ? 'hidden' : ''}`}>
                <Play size={48} className="text-gray-400" />
              </div>

              {/* Play overlay */}
              {video.url && isValidUrl(video.url) && (
                <div 
                  className="absolute inset-0 transition-all duration-300 flex items-center justify-center cursor-pointer"
                  onClick={() => handleOpenVideoInNewTab(video.url || '')}
                  title="Watch video"
                >
                  <div className="bg-white bg-opacity-90 rounded-full p-4 opacity-0 hover:opacity-100 transition-opacity duration-300">
                    <Play size={32} className="text-gray-800" />
                  </div>
                </div>
              )}
            </div>

            {/* Video Details */}
            <div className="p-4">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
                {video.title || 'Property Video'}
              </h4>
              {video.description && (
                <p className="text-sm text-gray-600 dark:text-gray-300 overflow-hidden" style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical'
                }}>
                  {video.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default PropertyVideoSection;
