import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Button, Spinner } from 'flowbite-react';
import { CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import subscriptionService from '../../../services/SubscriptionService';
import { useSubscriptionNotifications } from '../../../hooks/useSubscriptionNotifications';

export function MockStripeCheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showSubscriptionSuccess, showPaymentError } = useSubscriptionNotifications();

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'redirecting'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const handlePayment = async () => {
      try {
        // Get parameters from URL
        const planId = searchParams.get('planId');
        const entityType = searchParams.get('entityType') as 'personal' | 'company';
        const entityId = searchParams.get('entityId');

        if (!planId || !entityType || !entityId) {
          throw new Error('Missing required payment parameters');
        }

        // Create payment session
        const paymentSession = await subscriptionService.createPaymentSession({
          planId,
          entityType,
          entityId
        });

        if (paymentSession.checkoutUrl) {
          // Redirect to Stripe checkout
          setStatus('redirecting');
          window.location.href = paymentSession.checkoutUrl;
        } else {
          throw new Error('No checkout URL received');
        }

      } catch (error: any) {
        console.error('Payment setup error:', error);
        setErrorMessage(error.message || 'Failed to setup payment. Please try again.');
        setStatus('error');
      }
    };

    handlePayment();
  }, [searchParams]);

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

