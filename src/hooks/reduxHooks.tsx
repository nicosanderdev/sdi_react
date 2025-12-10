import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { useAuth } from '../contexts/AuthContext';
import type { RootState, AppDispatch } from '../store';

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

/**
 * Custom hook that provides both Redux dispatch and current user from AuthContext
 * This helps avoid redundant API calls by passing user data to service methods
 */
export const useAppDispatchWithUser = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useAuth();

  return { dispatch, user };
};