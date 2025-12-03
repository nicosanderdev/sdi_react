import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MockStripeCheckout } from '../../../components/ui/MockStripeCheckout';
import { useSubscriptionNotifications } from '../../../hooks/useSubscriptionNotifications';

export function MockStripeCheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showSubscriptionSuccess, showPaymentError } = useSubscriptionNotifications();

  // Get plan details from URL params (in a real implementation, these would come from your backend)
  const planId = searchParams.get('planId') || 'premium';
  const planName = searchParams.get('planName') || 'Premium Plan';
  const planPrice = parseFloat(searchParams.get('planPrice') || '29.99');

  const [isProcessing, setIsProcessing] = useState(false);

  const handlePaymentSuccess = (paymentData: any) => {
    console.log('Mock payment successful:', paymentData);
    showSubscriptionSuccess(planName);

    // Navigate to success page after a brief delay
    setTimeout(() => {
      navigate('/dashboard/subscription/success?action=upgrade');
    }, 2000);
  };

  const handlePaymentCancel = () => {
    navigate('/dashboard/subscription');
  };

  return (
    <MockStripeCheckout
      planName={planName}
      planPrice={planPrice}
      currency="USD"
      onSuccess={handlePaymentSuccess}
      onCancel={handlePaymentCancel}
      isProcessing={isProcessing}
    />
  );
}

