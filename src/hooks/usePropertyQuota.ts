import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSubscriptionGate } from './useSubscriptionGate';
import propertyService from '../services/PropertyService';

export interface PropertyQuotaState {
  // Counts
  ownedCount: number;
  publishedCount: number;

  // Limits
  totalLimit: number; // Hard cap of 10
  publishedLimit: number; // From subscription plan

  // Remaining
  remainingTotal: number;
  remainingPublished: number;

  // Status flags
  isAtTotalLimit: boolean;
  isAtPublishedLimit: boolean;
  isOverTotalLimit: boolean;
  isOverPublishedLimit: boolean;

  // Loading and error states
  isLoading: boolean;
  error: string | null;

  // Utility methods
  canCreateProperty: boolean;
  canPublishProperty: boolean;
}

export function usePropertyQuota(): PropertyQuotaState {
  const [state, setState] = useState<PropertyQuotaState>({
    ownedCount: 0,
    publishedCount: 0,
    totalLimit: 10, // Hard cap
    publishedLimit: 0,
    remainingTotal: 10,
    remainingPublished: 0,
    isAtTotalLimit: false,
    isAtPublishedLimit: false,
    isOverTotalLimit: false,
    isOverPublishedLimit: false,
    isLoading: true,
    error: null,
    canCreateProperty: true,
    canPublishProperty: true,
  });

  const { personalSubscription, hasPersonalSubscription } = useSubscriptionGate();
  const { user } = useAuth();

  useEffect(() => {
    const fetchPropertyCounts = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        // Fetch counts in parallel
        const [ownedCount, publishedCount] = await Promise.all([
          propertyService.getOwnedPropertiesCount(user),
          propertyService.getPublishedPropertiesCount(user)
        ]);

        // Get published limit from subscription
        const publishedLimit = hasPersonalSubscription && personalSubscription?.plan.maxProperties
          ? personalSubscription.plan.maxProperties
          : 0;

        // Calculate derived values
        const remainingTotal = Math.max(0, state.totalLimit - ownedCount);
        const remainingPublished = Math.max(0, publishedLimit - publishedCount);

        const isAtTotalLimit = ownedCount >= state.totalLimit;
        const isAtPublishedLimit = publishedCount >= publishedLimit;
        const isOverTotalLimit = ownedCount > state.totalLimit;
        const isOverPublishedLimit = publishedCount > publishedLimit;

        setState({
          ownedCount,
          publishedCount,
          totalLimit: state.totalLimit,
          publishedLimit,
          remainingTotal,
          remainingPublished,
          isAtTotalLimit,
          isAtPublishedLimit,
          isOverTotalLimit,
          isOverPublishedLimit,
          isLoading: false,
          error: null,
          canCreateProperty: ownedCount < state.totalLimit,
          canPublishProperty: publishedCount < publishedLimit,
        });
      } catch (error: any) {
        console.error('Error fetching property quota data:', error);
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error.message || 'Failed to fetch property quota information'
        }));
      }
    };

    // Only fetch if we have subscription data available
    if (hasPersonalSubscription !== undefined) {
      fetchPropertyCounts();
    }
  }, [personalSubscription, hasPersonalSubscription, state.totalLimit]);

  return state;
}
