import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useSubscriptionGate } from './useSubscriptionGate';
import propertyService from '../services/PropertyService';
import subscriptionService from '../services/SubscriptionService';

export interface PropertyQuotaState {
  hasPersonalSubscription: boolean;
  ownedCount: number;
  publishedCount: number;
  /** Null = unlimited */
  totalLimit: number | null;
  /** Null = unlimited */
  publishedLimit: number | null;
  remainingTotal: number | null;
  remainingPublished: number | null;
  isAtTotalLimit: boolean;
  isAtPublishedLimit: boolean;
  isOverTotalLimit: boolean;
  isOverPublishedLimit: boolean;
  isLoading: boolean;
  error: string | null;
  canCreateProperty: boolean;
  canPublishProperty: boolean;
  maxPhotosPerProperty: number | null;
}

function deriveQuota(
  hasPersonalSubscription: boolean,
  ownedCount: number,
  publishedCount: number,
  totalLimit: number | null,
  publishedLimit: number | null,
  maxPhotosPerProperty: number | null
): Omit<PropertyQuotaState, 'isLoading' | 'error'> {
  const remainingTotal = totalLimit == null ? null : Math.max(0, totalLimit - ownedCount);
  const remainingPublished = publishedLimit == null ? null : Math.max(0, publishedLimit - publishedCount);
  const isAtTotalLimit = totalLimit != null && ownedCount >= totalLimit;
  const isAtPublishedLimit = publishedLimit != null && publishedCount >= publishedLimit;
  const isOverTotalLimit = totalLimit != null && ownedCount > totalLimit;
  const isOverPublishedLimit = publishedLimit != null && publishedCount > publishedLimit;

  return {
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
    canCreateProperty: totalLimit == null || ownedCount < totalLimit,
    canPublishProperty: publishedLimit == null || publishedCount < publishedLimit,
    maxPhotosPerProperty,
  };
}

export function usePropertyQuota(companyId?: string | null): PropertyQuotaState {
  const [state, setState] = useState<PropertyQuotaState>({
    ...deriveQuota(false, 0, 0, 20, 15, null),
    isLoading: true,
    error: null,
  });

  const { personalSubscription, hasPersonalSubscription } = useSubscriptionGate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const fetchPropertyCounts = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const countOpts = companyId ? { companyId } : undefined;
      const [ownedCount, publishedCount, companySubscription] = await Promise.all([
        propertyService.getOwnedPropertiesCount(user, countOpts),
        propertyService.getPublishedPropertiesCount(user, countOpts),
        companyId
          ? subscriptionService.getCompanySubscription(companyId).catch(() => null)
          : Promise.resolve(null),
      ]);

      const plan = companyId ? companySubscription?.plan : personalSubscription?.plan;
      const totalLimit = plan?.totalProperties ?? plan?.maxProperties ?? null;
      const publishedLimit = plan?.publishedProperties ?? null;
      const maxPhotosPerProperty = plan?.maxPhotosPerProperty ?? null;

      setState({
        ...deriveQuota(
          !!hasPersonalSubscription || !!companySubscription,
          ownedCount,
          publishedCount,
          totalLimit,
          publishedLimit,
          maxPhotosPerProperty
        ),
        isLoading: false,
        error: null,
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

  useEffect(() => {
    if (companyId || hasPersonalSubscription !== undefined) {
      fetchPropertyCounts();
    }
  }, [personalSubscription, hasPersonalSubscription, companyId]);

  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'removed' || (event.type === 'updated' && event.query.queryKey[0] === 'properties')) {
        if (companyId || hasPersonalSubscription !== undefined) {
          fetchPropertyCounts();
        }
      }
    });

    return unsubscribe;
  }, [queryClient, hasPersonalSubscription, personalSubscription, user, companyId]);

  return state;
}
