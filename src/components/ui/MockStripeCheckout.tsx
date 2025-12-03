import React, { useState } from 'react';
import { Card, Button, TextInput, Select, Spinner } from 'flowbite-react';
import {
  CreditCard,
  Lock,
  CheckCircle,
  AlertTriangle,
  ArrowLeft
} from 'lucide-react';

interface MockStripeCheckoutProps {
  planName: string;
  planPrice: number;
  currency?: string;
  onSuccess: (paymentData: any) => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

interface PaymentFormData {
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvc: string;
  cardholderName: string;
  email: string;
}

export function MockStripeCheckout({
  planName,
  planPrice,
  currency = 'USD',
  onSuccess,
  onCancel,
  isProcessing = false
}: MockStripeCheckoutProps) {
  const [step, setStep] = useState<'form' | 'processing' | 'success' | 'error'>('form');
  const [formData, setFormData] = useState<PaymentFormData>({
    cardNumber: '',
    expiryMonth: '',
    expiryYear: '',
    cvc: '',
    cardholderName: '',
    email: ''
  });
  const [errors, setErrors] = useState<Partial<PaymentFormData>>({});

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<PaymentFormData> = {};

    // Basic validation - in real Stripe this would be handled client-side
    if (!formData.cardNumber.replace(/\s/g, '').match(/^\d{13,19}$/)) {
      newErrors.cardNumber = 'Invalid card number';
    }

    if (!formData.expiryMonth || !formData.expiryYear) {
      newErrors.expiryMonth = 'Expiry date is required';
    }

    if (!formData.cvc.match(/^\d{3,4}$/)) {
      newErrors.cvc = 'Invalid CVC';
    }

    if (!formData.cardholderName.trim()) {
      newErrors.cardholderName = 'Cardholder name is required';
    }

    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      newErrors.email = 'Invalid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setStep('processing');

    // Simulate processing delay
    setTimeout(() => {
      // Mock success - in real implementation, this would be handled by Stripe
      const mockPaymentData = {
        id: `mock_pi_${Date.now()}`,
        status: 'succeeded',
        amount: planPrice * 100, // Convert to cents
        currency: currency.toLowerCase(),
        planName,
        cardLast4: formData.cardNumber.slice(-4),
        timestamp: new Date().toISOString()
      };

      setStep('success');

      // Call success callback after a brief delay
      setTimeout(() => {
        onSuccess(mockPaymentData);
      }, 1500);
    }, 2000);
  };

  const handleInputChange = (field: keyof PaymentFormData, value: string) => {
    if (field === 'cardNumber') {
      value = formatCardNumber(value);
    }

    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  if (step === 'processing') {
    return (
      <div className="max-w-md mx-auto p-6">
        <Card>
          <div className="text-center py-8">
            <Spinner size="xl" className="mb-4" />
            <h3 className="text-lg font-semibold mb-2">Processing Payment</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Please wait while we process your payment...
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="max-w-md mx-auto p-6">
        <Card>
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-green-900 mb-2">
              Payment Successful!
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Your subscription to {planName} has been activated.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="max-w-md mx-auto p-6">
        <Card>
          <div className="text-center py-8">
            <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-900 mb-2">
              Payment Failed
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              There was an error processing your payment. Please try again.
            </p>
            <Button onClick={() => setStep('form')}>
              Try Again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <Card>
        <div className="mb-6">
          <button
            onClick={onCancel}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2">Complete Your Purchase</h2>
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <p className="text-lg font-semibold">{planName}</p>
              <p className="text-2xl font-bold text-[#1B4965] dark:text-blue-400">
                ${planPrice}/{currency === 'USD' ? 'month' : 'period'}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Card Number */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Card Number
            </label>
            <TextInput
              type="text"
              placeholder="1234 5678 9012 3456"
              value={formData.cardNumber}
              onChange={(e) => handleInputChange('cardNumber', e.target.value)}
              maxLength={19}
              color={errors.cardNumber ? 'failure' : undefined}
              helperText={errors.cardNumber}
              icon={CreditCard}
            />
          </div>

          {/* Expiry Date and CVC */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1">
              <label className="block text-sm font-medium mb-2">
                Month
              </label>
              <Select
                value={formData.expiryMonth}
                onChange={(e) => handleInputChange('expiryMonth', e.target.value)}
                color={errors.expiryMonth ? 'failure' : undefined}
              >
                <option value="">MM</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                    {String(i + 1).padStart(2, '0')}
                  </option>
                ))}
              </Select>
            </div>
            <div className="col-span-1">
              <label className="block text-sm font-medium mb-2">
                Year
              </label>
              <Select
                value={formData.expiryYear}
                onChange={(e) => handleInputChange('expiryYear', e.target.value)}
                color={errors.expiryYear ? 'failure' : undefined}
              >
                <option value="">YY</option>
                {Array.from({ length: 10 }, (_, i) => {
                  const year = new Date().getFullYear() + i;
                  return (
                    <option key={year} value={String(year).slice(-2)}>
                      {String(year).slice(-2)}
                    </option>
                  );
                })}
              </Select>
            </div>
            <div className="col-span-1">
              <label className="block text-sm font-medium mb-2">
                CVC
              </label>
              <TextInput
                type="text"
                placeholder="123"
                value={formData.cvc}
                onChange={(e) => handleInputChange('cvc', e.target.value)}
                maxLength={4}
                color={errors.cvc ? 'failure' : undefined}
              />
            </div>
          </div>
          {errors.expiryMonth && (
            <p className="text-red-600 text-sm">{errors.expiryMonth}</p>
          )}

          {/* Cardholder Name */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Cardholder Name
            </label>
            <TextInput
              type="text"
              placeholder="John Doe"
              value={formData.cardholderName}
              onChange={(e) => handleInputChange('cardholderName', e.target.value)}
              color={errors.cardholderName ? 'failure' : undefined}
              helperText={errors.cardholderName}
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Email Address
            </label>
            <TextInput
              type="email"
              placeholder="john@example.com"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              color={errors.email ? 'failure' : undefined}
              helperText={errors.email}
            />
          </div>

          {/* Security Notice */}
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <Lock className="w-4 h-4" />
            <span>Your payment information is secure and encrypted</span>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4 mr-2" />
                Pay ${planPrice}
              </>
            )}
          </Button>

          {/* Mock Notice */}
          <div className="text-center text-xs text-gray-500 dark:text-gray-400 mt-4">
            This is a mock checkout for testing purposes. No real payment will be processed.
          </div>
        </form>
      </Card>
    </div>
  );
}

