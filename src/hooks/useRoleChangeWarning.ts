import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  showRoleChangeWarning,
  hideRoleChangeWarning,
  selectRoleChangeWarning
} from '../store/slices/subscriptionSlice';
import { CompanyRoles } from '../models/CompanyRoles';

export function useRoleChangeWarning() {
  const dispatch = useDispatch();
  const warning = useSelector(selectRoleChangeWarning);

  const showWarning = useCallback((
    newRole: string,
    affectedCompanies: string[],
    onConfirm?: () => void,
    onCancel?: () => void
  ) => {
    dispatch(showRoleChangeWarning({
      newRole,
      affectedCompanies,
      onConfirm,
      onCancel,
    }));
  }, [dispatch]);

  const hideWarning = useCallback(() => {
    dispatch(hideRoleChangeWarning());
  }, [dispatch]);

  // Specific helper for admin to manager role change
  const showAdminToManagerWarning = useCallback((
    affectedCompanies: string[],
    onConfirm?: () => void,
    onCancel?: () => void
  ) => {
    showWarning(
      CompanyRoles.Manager,
      affectedCompanies,
      onConfirm,
      onCancel
    );
  }, [showWarning]);

  // Check if a role change requires warning
  const requiresWarning = useCallback((currentRole: string, newRole: string): boolean => {
    // Currently, only admin to manager change requires warning
    return currentRole === CompanyRoles.Admin && newRole === CompanyRoles.Manager;
  }, []);

  return {
    warning,
    showWarning,
    hideWarning,
    showAdminToManagerWarning,
    requiresWarning,
  };
}

