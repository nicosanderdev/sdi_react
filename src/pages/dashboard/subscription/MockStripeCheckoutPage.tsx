import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store/store';
import { Card, Button, Spinner } from 'flowbite-react';
import { CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import subscriptionService from '../../../services/SubscriptionService';
import { useSubscriptionNotifications } from '../../../hooks/useSubscriptionNotifications';
import { usePayment } from '../../../contexts/PaymentContext';
import { CreatePaymentRequest } from '../../../models/payments/PaymentData';

export function MockStripeCheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useSelector((state: RootState) => state.user.profile);
  const { createPayment } = usePayment();
  const { showSubscriptionSuccess, showPaymentError } = useSubscriptionNotifications();

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'redirecting'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const handlePayment = async () => {
      try {
        // Get parameters from URL
        const planId = searchParams.get('planId');
        const entityType = (searchParams.get('entityType') as 'personal' | 'company') || 'personal';
        const entityId = searchParams.get('entityId') || user?.id;

        if (!planId || !user) {
          throw new Error('Missing required payment parameters');
        }

        // Get plan details
        const plans = await subscriptionService.getPlans();
        const selectedPlan = plans.find(plan => plan.id === planId);
        if (!selectedPlan) {
          throw new Error('Plan not found');
        }

        // Create order ID for subscription payment
        const orderId = `sub_${entityType}_${entityId}_${planId}_${Date.now()}`;

        // Create payment request for DLocal
        const paymentRequest: CreatePaymentRequest = {
          amount: selectedPlan.monthlyPrice,
          currency: selectedPlan.currency,
          paymentMethod: 'card',
          orderId,
          description: `Subscription to ${selectedPlan.name} plan`,
          customerInfo: {
            name: user.firstName && user.lastName
              ? `${user.firstName} ${user.lastName}`
              : user.email?.split('@')[0] || 'User',
            email: user.email || '',
            phone: user.phone || ''
          },
          callbackUrl: `${window.location.origin}/dashboard/payments/callback`
        };

        // Create payment using DLocal
        const paymentResponse = await createPayment(paymentRequest);

        if (paymentResponse.redirectUrl) {
          // Redirect to DLocal payment page
          setStatus('redirecting');
          window.location.href = paymentResponse.redirectUrl;
        } else {
          throw new Error('No redirect URL received from payment service');
        }

      } catch (error: any) {
        console.error('Payment setup error:', error);
        setErrorMessage(error.message || 'Failed to setup payment. Please try again.');
        setStatus('error');
      }
    };

    handlePayment();
  }, [searchParams, user, createPayment]);

  const handleRetry = () => {
    navigate('/dashboard/subscription');
  };

  const handleCancel = () => {
    navigate('/dashboard/subscription');
  };

  if (status === 'loading') {
    return (
      <div className="max-w-md mx-auto p-6">
        <Card>
          <div className="text-center py-8">
            <Spinner size="xl" className="mb-4" />
            <h3 className="text-lg font-semibold mb-2">Setting up payment...</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Please wait while we prepare your checkout session.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (status === 'redirecting') {
    return (
      <div className="max-w-md mx-auto p-6">
        <Card>
          <div className="text-center py-8">
            <Spinner size="xl" className="mb-4" />
            <h3 className="text-lg font-semibold mb-2">Redirecting to payment...</h3>
            <p className="text-gray-600 dark:text-gray-400">
              You will be redirected to our secure payment processor.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="max-w-md mx-auto p-6">
        <Card>
          <div className="text-center py-8">
            <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-900 mb-2">
              Payment Setup Failed
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {errorMessage}
            </p>
            <div className="space-y-3">
              <Button onClick={handleRetry} className="w-full">
                Try Again
              </Button>
              <Button
                onClick={handleCancel}
                color="light"
                className="w-full"
              >
                Back to Plans
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // This shouldn't be reached, but fallback
  return null;
}

