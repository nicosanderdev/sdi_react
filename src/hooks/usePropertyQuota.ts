import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useSubscriptionGate } from './useSubscriptionGate';
import propertyService from '../services/PropertyService';

export interface PropertyQuotaState {
  // Subscription status
  hasPersonalSubscription: boolean;

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
    hasPersonalSubscription: false,
    ownedCount: 0,
    publishedCount: 0,
    totalLimit: 10, // Hard cap
    publishedLimit: 2,
    remainingTotal: 10,
    remainingPublished: 2,
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
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchPropertyCounts = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        // Fetch counts in parallel
        const [ownedCount, publishedCount] = await Promise.all([
          propertyService.getOwnedPropertiesCount(user),
          propertyService.getPublishedPropertiesCount(user)
        ]);

        // Get limits from subscription (free users get 2 properties total and 2 published)
        const publishedLimit = hasPersonalSubscription && personalSubscription?.plan.maxProperties
          ? personalSubscription.plan.maxProperties
          : 2;

        // Total limit: subscribed users get their plan limit, free users get 2, hard cap of 10
        const totalLimit = hasPersonalSubscription && personalSubscription?.plan.maxProperties
          ? Math.min(personalSubscription.plan.maxProperties, state.totalLimit) // state.totalLimit is the hard cap (10)
          : 2; // Free users get 2 total properties

        // Calculate derived values
        const remainingTotal = Math.max(0, totalLimit - ownedCount);
        const remainingPublished = Math.max(0, publishedLimit - publishedCount);

        const isAtTotalLimit = ownedCount >= totalLimit;
        const isAtPublishedLimit = publishedCount >= publishedLimit;
        const isOverTotalLimit = ownedCount > totalLimit;
        const isOverPublishedLimit = publishedCount > publishedLimit;

        setState({
          hasPersonalSubscription,
          ownedCount,
          publishedCount,
          totalLimit,
          publishedLimit,
          remainingTotal,
          remainingPublished,
          isAtTotalLimit,
          isAtPublishedLimit,
          isOverTotalLimit,
          isOverPublishedLimit,
          isLoading: false,
          error: null,
          canCreateProperty: ownedCount < totalLimit,
          canPublishProperty: publishedCount < publishedLimit,
        });
      } catch (error: any) {
        console.error('Error fetching property quota data:', error);
        setState(prev => ({
          ...prev,
          hasPersonalSubscription: false,
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

  // Refresh quota when properties query is invalidated
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'removed' || (event.type === 'updated' && event.query.queryKey[0] === 'properties')) {
        // Properties were invalidated or removed, refresh quota
        if (hasPersonalSubscription !== undefined) {
          // Trigger a re-fetch by calling the effect again
          const fetchPropertyCounts = async () => {
            try {
              setState(prev => ({ ...prev, isLoading: true, error: null }));

              // Fetch counts in parallel
              const [ownedCount, publishedCount] = await Promise.all([
                propertyService.getOwnedPropertiesCount(user),
                propertyService.getPublishedPropertiesCount(user)
              ]);

              // Get limits from subscription (free users get 2 properties total and 2 published)
              const publishedLimit = hasPersonalSubscription && personalSubscription?.plan.maxProperties
                ? personalSubscription.plan.maxProperties
                : 2;

              // Total limit: subscribed users get their plan limit, free users get 2, hard cap of 10
              const totalLimit = hasPersonalSubscription && personalSubscription?.plan.maxProperties
                ? Math.min(personalSubscription.plan.maxProperties, state.totalLimit) // state.totalLimit is the hard cap (10)
                : 2; // Free users get 2 total properties

              // Calculate derived values
              const remainingTotal = Math.max(0, totalLimit - ownedCount);
              const remainingPublished = Math.max(0, publishedLimit - publishedCount);

              const isAtTotalLimit = ownedCount >= totalLimit;
              const isAtPublishedLimit = publishedCount >= publishedLimit;
              const isOverTotalLimit = ownedCount > totalLimit;
              const isOverPublishedLimit = publishedCount > publishedLimit;

              setState({
                hasPersonalSubscription,
                ownedCount,
                publishedCount,
                totalLimit,
                publishedLimit,
                remainingTotal,
                remainingPublished,
                isAtTotalLimit,
                isAtPublishedLimit,
                isOverTotalLimit,
                isOverPublishedLimit,
                isLoading: false,
                error: null,
                canCreateProperty: ownedCount < totalLimit,
                canPublishProperty: publishedCount < publishedLimit,
              });
            } catch (error: any) {
              console.error('Error fetching property quota data:', error);
              setState(prev => ({
                ...prev,
                hasPersonalSubscription: false,
                isLoading: false,
                error: error.message || 'Failed to fetch property quota information'
              }));
            }
          };
          fetchPropertyCounts();
        }
      }
    });

    return unsubscribe;
  }, [queryClient, hasPersonalSubscription, personalSubscription, state.totalLimit, user]);

  return state;
}
