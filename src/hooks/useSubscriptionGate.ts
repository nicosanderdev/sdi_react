import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import subscriptionService from '../services/SubscriptionService';
import { SubscriptionData } from '../models/subscriptions/SubscriptionData';
import { PlanKey } from '../models/subscriptions/PlanKey';

export interface SubscriptionGateState {
  // Personal subscription
  hasPersonalSubscription: boolean;
  personalSubscription: SubscriptionData | null;

  // Company access
  hasCompanyMembership: boolean;
  companyIds: string[];

  // Loading and error states
  isLoading: boolean;
  error: string | null;
}

export function useSubscriptionGate(): SubscriptionGateState {
  const [state, setState] = useState<SubscriptionGateState>({
    hasPersonalSubscription: false,
    personalSubscription: null,
    hasCompanyMembership: false,
    companyIds: [],
    isLoading: true,
    error: null,
  });

  const { user } = useAuth();

  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        const { subscription, userAccess } = await subscriptionService.getSubscriptionStatus(user);

        // Check if personal subscription is active (status === 1 indicates active)
        const hasPersonalSubscription = subscription.status === '1';

        setState({
          hasPersonalSubscription,
          personalSubscription: subscription,
          hasCompanyMembership: userAccess.hasCompanyAccess,
          companyIds: userAccess.companyIds,
          isLoading: false,
          error: null,
        });
      } catch (error: any) {
        console.error('Error fetching subscription status:', error);

        // Handle missing subscription gracefully - provide default free state
        const defaultFreeSubscription: SubscriptionData = {
          id: '',
          ownerType: '0',
          ownerId: '', // Will be filled by getSubscriptionStatus if needed
          providerCustomerId: '',
          providerSubscriptionId: '',
          planId: '',
          plan: {
            id: '',
            key: PlanKey.FREE,
            name: 'Free',
            monthlyPrice: 0,
            currency: 'USD',
            maxProperties: 0,
            maxUsers: 1,
            maxStorageMb: 0,
            billingCycle: '1',
            isActive: true
          },
          status: '0', // 0 = inactive/cancelled (no active subscription)
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(),
          cancelAtPeriodEnd: false,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        setState({
          hasPersonalSubscription: false,
          personalSubscription: defaultFreeSubscription,
          hasCompanyMembership: false,
          companyIds: [],
          isLoading: false,
          error: null, // No error - graceful handling
        });
      }
    };

    fetchSubscriptionStatus();
  }, []);

  return state;
}
