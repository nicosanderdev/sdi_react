import React from 'react';
import { Heart } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store/store';
import { updatePropertyFavorite, selectIsPropertyFavorite, fetchFavoriteProperties } from '../../store/slices/favoritesSlice';
import { selectUserProfile } from '../../store/slices/userSlice';

interface FavoriteButtonProps {
  propertyId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const FavoriteButton: React.FC<FavoriteButtonProps> = ({ 
  propertyId, 
  size = 'md',
  className = '' 
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector(selectUserProfile);
  const isFavorite = useSelector(selectIsPropertyFavorite(propertyId));
  const favoritesStatus = useSelector((state: RootState) => state.favorites.status);

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if user is authenticated
    if (!user || !user.id) {
      // Redirect to login page or show a message
      window.location.href = '/login';
      return;
    }
    
    if (favoritesStatus === 'loading') return;
    
    try {
      await dispatch(updatePropertyFavorite({ 
        propertyId, 
        isFavorite: !isFavorite 
      })).unwrap();
      
      dispatch(fetchFavoriteProperties());
    } catch (error) {
      console.error('Failed to update favorite status:', error);
    }
  };

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
  };

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <button
      onClick={handleToggleFavorite}
      disabled={favoritesStatus === 'loading'}
      className={`
        ${sizeClasses[size]}
        flex items-center justify-center
        rounded-full
        transition-all duration-200
        hover:scale-110
        focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${!user || !user.id 
          ? 'bg-gray-200 text-gray-400 cursor-pointer hover:bg-gray-300' 
          : isFavorite 
            ? 'bg-red-500 text-white shadow-lg' 
            : 'bg-white text-gray-400 hover:text-red-500 hover:bg-red-50 shadow-md'
        }
        ${className}
      `}
      aria-label={!user || !user.id ? 'Login to add to favorites' : isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      title={!user || !user.id ? 'Login to add to favorites' : isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Heart 
        className={`
          ${iconSizeClasses[size]}
          transition-all duration-200
          ${isFavorite ? 'fill-current' : ''}
        `}
      />
    </button>
  );
};

export default FavoriteButton;
