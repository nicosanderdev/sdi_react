import React from 'react';
import { Trash2, Play, Edit3, Save, X, Plus, ExternalLink } from 'lucide-react';
import { Button, TextInput, Textarea } from 'flowbite-react';

export interface DisplayVideo {
    key: string;
    title: string;
    description: string;
    url?: string;
    thumbnailUrl?: string;
    source: 'existing' | 'new';
    id?: string;
    isEditing?: boolean;
}

interface VideoManagerProps {
    displayVideos: DisplayVideo[];
    onVideosChange: (videos: DisplayVideo[] | ((prev: DisplayVideo[]) => DisplayVideo[])) => void;
}

export const VideoManager: React.FC<VideoManagerProps> = ({
    displayVideos,
    onVideosChange
}) => {

    // --- Video Handlers ---

    const handleDeleteVideo = (key: string) => {
        onVideosChange((prev: DisplayVideo[]) => prev.filter((video: DisplayVideo) => video.key !== key));
    };

    const handleAddVideo = () => {
        const newVideo: DisplayVideo = {
            key: `url-${Date.now()}`,
            title: '',
            description: '',
            url: '',
            source: 'new',
            isEditing: true
        };
        onVideosChange((prev: DisplayVideo[]) => [...prev, newVideo]);
    };

    const handleVideoTitleChange = (key: string, newTitle: string) => {
        onVideosChange((prev: DisplayVideo[]) => prev.map(video => 
            video.key === key ? { ...video, title: newTitle } : video
        ));
    };

    const handleVideoDescriptionChange = (key: string, newDescription: string) => {
        onVideosChange((prev: DisplayVideo[]) => prev.map(video => 
            video.key === key ? { ...video, description: newDescription } : video
        ));
    };

    const handleVideoUrlChange = (key: string, newUrl: string) => {
        onVideosChange((prev: DisplayVideo[]) => prev.map(video => 
            video.key === key ? { ...video, url: newUrl } : video
        ));
    };

    const handleSaveVideo = (key: string) => {
        const video = displayVideos.find(v => v.key === key);
        if (!video) return;

        if (!video.url || !video.url.trim()) {
            alert('Por favor, ingresa una URL válida para el video.');
            return;
        }

        if (!isValidUrl(video.url)) {
            alert('Por favor, ingresa una URL válida para el video.');
            return;
        }

        onVideosChange((prev: DisplayVideo[]) => prev.map(v => 
            v.key === key ? { ...v, isEditing: false, url: v.url?.trim() || '' } : v
        ));
    };

    const handleEditVideo = (key: string) => {
        onVideosChange((prev: DisplayVideo[]) => prev.map(video => 
            video.key === key ? { ...video, isEditing: true } : video
        ));
    };

    const handleCancelEdit = (key: string) => {
        const video = displayVideos.find(v => v.key === key);
        if (video && video.source === 'new' && !video.title && !video.url) {
            handleDeleteVideo(key);
        } else {
            onVideosChange((prev: DisplayVideo[]) => prev.map(v => 
                v.key === key ? { ...v, isEditing: false } : v
            ));
        }
    };

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
                // Try multiple thumbnail qualities, fallback to maxresdefault, then hqdefault, then sddefault
                return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
            }
        }
        // For Vimeo videos
        if (url.includes('vimeo.com/')) {
            const videoId = url.split('vimeo.com/')[1].split('?')[0];
            return `https://vumbnail.com/${videoId}.jpg`;
        }
        // For other video URLs, return a placeholder
        return '';
    };

    const handleOpenVideoInNewTab = (url: string) => {
        if (url && url.trim()) {
            // Ensure URL has protocol
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

    return (
        <div className='p-4 md:p-6'>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold border-b pb-2 flex-1">Videos</h3>
                <Button
                    onClick={handleAddVideo}
                    className="flex items-center gap-2 mx-2"
                >
                    <Plus size={20} />
                    Agregar Video
                </Button>
            </div>

            {displayVideos.length > 0 && (
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {displayVideos.map((video) => (
                        <div key={video.key} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden group">
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
                                            // Show the fallback play button
                                            const fallback = target.parentElement?.querySelector('.thumbnail-fallback') as HTMLElement;
                                            if (fallback) {
                                                fallback.classList.remove('hidden');
                                            }
                                        }}
                                        onLoad={(e) => {
                                            // Hide the fallback when image loads successfully
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

                                {/* Open in new tab overlay */}
                                {video.url && isValidUrl(video.url) && (
                                    <div 
                                        className="absolute inset-0 transition-all duration-300 flex items-center justify-center cursor-pointer"
                                        onClick={() => handleOpenVideoInNewTab(video.url || '')}
                                        title="Abrir video en nueva pestaña"
                                    >
                                        <div className="bg-white bg-opacity-90 rounded-full p-3 opacity-0 hover:opacity-100 transition-opacity duration-300">
                                            <ExternalLink size={24} className="text-gray-800" />
                                        </div>
                                    </div>
                                )}

                                {/* Action buttons */}
                                <div className="absolute top-2 right-2 flex gap-1">
                                    {video.isEditing ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => handleSaveVideo(video.key)}
                                                className="p-1.5 bg-green-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300"
                                                title="Guardar"
                                            >
                                                <Save size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleCancelEdit(video.key)}
                                                className="p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300"
                                                title="Cancelar"
                                            >
                                                <X size={14} />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => handleEditVideo(video.key)}
                                                className="p-1.5 bg-blue-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300"
                                                title="Editar"
                                            >
                                                <Edit3 size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteVideo(video.key)}
                                                className="p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300"
                                                title="Eliminar video"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Video Details */}
                            <div className="p-4">
                                {video.isEditing ? (
                                    <div className="space-y-3">
                                        <TextInput
                                            value={video.title}
                                            onChange={(e) => handleVideoTitleChange(video.key, e.target.value)}
                                            placeholder="Título del video"
                                            className="text-sm font-medium"
                                        />
                                        <div>
                                            <TextInput
                                                value={video.url || ''}
                                                onChange={(e) => handleVideoUrlChange(video.key, e.target.value)}
                                                placeholder="URL del video (YouTube, Vimeo, etc.)"
                                                className="text-xs"
                                                color={video.url && !isValidUrl(video.url) ? "failure" : undefined}
                                            />
                                            {video.url && !isValidUrl(video.url) && (
                                                <p className="text-xs text-red-600 mt-1">Por favor, ingresa una URL válida</p>
                                            )}
                                        </div>
                                        <Textarea
                                            value={video.description}
                                            onChange={(e) => handleVideoDescriptionChange(video.key, e.target.value)}
                                            placeholder="Descripción del video"
                                            rows={2}
                                            className="text-xs"
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">
                                            {video.title || 'Sin título'}
                                        </h4>
                                        {video.url && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate">
                                                {video.url}
                                            </p>
                                        )}
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
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
