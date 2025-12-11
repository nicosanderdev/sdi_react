import React, { useState } from 'react';
import { Card, Button, TextInput, Select, Spinner } from 'flowbite-react';
import { CreditCard, Lock, User, Mail, Phone, FileText } from 'lucide-react';
import { usePaymentGateway } from '../../hooks/usePaymentGateway';
import { usePaymentValidation } from '../../hooks/usePaymentValidation';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { CreatePaymentRequest } from '../../models/payments/PaymentData';

interface PaymentFormProps {
    propertyId?: string;
    amount?: number;
    currency?: string;
    onSuccess?: (paymentData: any) => void;
    onCancel?: () => void;
    orderId?: string;
}

export function PaymentForm({
    propertyId,
    amount = 0,
    currency = 'USD',
    onSuccess,
    onCancel,
    orderId
}: PaymentFormProps) {
    const { createPayment, isProcessing, error, clearError } = usePaymentGateway();
    const {
        formData,
        errors,
        isValid,
        setFormData,
        validateForm,
        clearErrors,
        getCustomerInfo
    } = usePaymentValidation({
        amount: amount.toString(),
        currency,
        paymentMethod: ''
    });

    const [step, setStep] = useState<'method' | 'details' | 'processing' | 'success' | 'error'>('method');

    const handleMethodSelect = (methodId: string) => {
        setFormData({ paymentMethod: methodId });
        setStep('details');
    };

    const handleBackToMethod = () => {
        setStep('method');
        clearErrors();
        clearError();
    };

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

    const handleInputChange = (field: string, value: string) => {
        if (field === 'cardNumber') {
            value = formatCardNumber(value);
        }
        setFormData({ [field]: value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        setStep('processing');

        try {
            const paymentRequest: CreatePaymentRequest = {
                amount: parseFloat(formData.amount),
                currency: formData.currency,
                paymentMethod: formData.paymentMethod,
                orderId: orderId || `order_${Date.now()}`,
                customerInfo: getCustomerInfo(),
                description: propertyId ? `Payment for property ${propertyId}` : 'Property payment',
                callbackUrl: `${window.location.origin}/payment/callback`
            };

            const response = await createPayment(paymentRequest);

            if (response.redirectUrl) {
                // Redirect to dLocal hosted payment page
                window.location.href = response.redirectUrl;
                return;
            }

            setStep('success');
            onSuccess?.(response);
        } catch (err: any) {
            console.error('Payment failed:', err);
            setStep('error');
        }
    };

    const renderMethodStep = () => (
        <div className="max-w-2xl mx-auto">
            <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">Choose Payment Method</h2>
                <p className="text-gray-600 dark:text-gray-400">
                    Select your preferred payment method to continue
                </p>
            </div>

            <PaymentMethodSelector
                selectedMethod={formData.paymentMethod}
                onMethodChange={handleMethodSelect}
                currency={formData.currency}
            />

            {onCancel && (
                <div className="mt-6 text-center">
                    <Button
                        onClick={onCancel}
                        color="light"
                        size="sm"
                    >
                        Cancel
                    </Button>
                </div>
            )}
        </div>
    );

    const renderDetailsStep = () => (
        <div className="max-w-2xl mx-auto">
            <div className="mb-6">
                <button
                    onClick={handleBackToMethod}
                    className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4"
                >
                    ← Back to payment methods
                </button>

                <h2 className="text-2xl font-bold mb-2">Payment Details</h2>
                <p className="text-gray-600 dark:text-gray-400">
                    Complete your payment information
                </p>
            </div>

            {/* Amount Summary */}
            <Card className="mb-6">
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold">Total Amount</span>
                        <span className="text-2xl font-bold text-[#1B4965] dark:text-blue-400">
                            {formData.currency} {parseFloat(formData.amount).toFixed(2)}
                        </span>
                    </div>
                </div>
            </Card>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Customer Information */}
                <Card>
                    <h3 className="text-lg font-semibold mb-4">Customer Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Full Name *
                            </label>
                            <TextInput
                                type="text"
                                placeholder="John Doe"
                                value={formData.customerName}
                                onChange={(e) => handleInputChange('customerName', e.target.value)}
                                color={errors.customerName ? 'failure' : undefined}
                                helperText={errors.customerName}
                                icon={User}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Email Address *
                            </label>
                            <TextInput
                                type="email"
                                placeholder="john@example.com"
                                value={formData.customerEmail}
                                onChange={(e) => handleInputChange('customerEmail', e.target.value)}
                                color={errors.customerEmail ? 'failure' : undefined}
                                helperText={errors.customerEmail}
                                icon={Mail}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Phone Number
                            </label>
                            <TextInput
                                type="tel"
                                placeholder="+1 234 567 8900"
                                value={formData.customerPhone}
                                onChange={(e) => handleInputChange('customerPhone', e.target.value)}
                                color={errors.customerPhone ? 'failure' : undefined}
                                helperText={errors.customerPhone}
                                icon={Phone}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Document/ID
                            </label>
                            <TextInput
                                type="text"
                                placeholder="123456789"
                                value={formData.customerDocument}
                                onChange={(e) => handleInputChange('customerDocument', e.target.value)}
                                color={errors.customerDocument ? 'failure' : undefined}
                                helperText={errors.customerDocument}
                                icon={FileText}
                            />
                        </div>
                    </div>
                </Card>

                {/* Payment Method Specific Fields */}
                {formData.paymentMethod === 'card' && (
                    <Card>
                        <h3 className="text-lg font-semibold mb-4">Card Information</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Card Number *
                                </label>
                                <TextInput
                                    type="text"
                                    placeholder="1234 5678 9012 3456"
                                    value={formData.cardNumber || ''}
                                    onChange={(e) => handleInputChange('cardNumber', e.target.value)}
                                    maxLength={19}
                                    icon={CreditCard}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Use test card: 4111 1111 1111 1111 (success) or 5555 5555 5555 4444 (decline)
                                </p>
                            </div>
                        </div>
                    </Card>
                )}

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
                    disabled={!isValid || isProcessing}
                >
                    {isProcessing ? (
                        <>
                            <Spinner size="sm" className="mr-2" />
                            Processing Payment...
                        </>
                    ) : (
                        <>
                            <CreditCard className="w-4 h-4 mr-2" />
                            Pay {formData.currency} {parseFloat(formData.amount).toFixed(2)}
                        </>
                    )}
                </Button>

                {onCancel && (
                    <div className="text-center">
                        <Button
                            onClick={onCancel}
                            color="light"
                            size="sm"
                        >
                            Cancel Payment
                        </Button>
                    </div>
                )}
            </form>
        </div>
    );

    const renderProcessingStep = () => (
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

    const renderSuccessStep = () => (
        <div className="max-w-md mx-auto p-6">
            <Card>
                <div className="text-center py-8">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-green-900 mb-2">
                        Payment Successful!
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                        Your payment has been processed successfully.
                    </p>
                </div>
            </Card>
        </div>
    );

    const renderErrorStep = () => (
        <div className="max-w-md mx-auto p-6">
            <Card>
                <div className="text-center py-8">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-red-900 mb-2">
                        Payment Failed
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                        {error || 'There was an error processing your payment. Please try again.'}
                    </p>
                    <div className="space-y-3">
                        <Button onClick={() => setStep('details')} className="w-full">
                            Try Again
                        </Button>
                        {onCancel && (
                            <Button
                                onClick={onCancel}
                                color="light"
                                className="w-full"
                            >
                                Cancel
                            </Button>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );

    switch (step) {
        case 'method':
            return renderMethodStep();
        case 'details':
            return renderDetailsStep();
        case 'processing':
            return renderProcessingStep();
        case 'success':
            return renderSuccessStep();
        case 'error':
            return renderErrorStep();
        default:
            return renderMethodStep();
    }
}
