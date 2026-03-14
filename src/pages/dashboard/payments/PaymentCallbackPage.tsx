import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Button, Spinner } from 'flowbite-react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { usePayment } from '../../../contexts/PaymentContext';

export function PaymentCallbackPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { checkPaymentStatus, currentPayment } = usePayment();

    const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
    const [paymentId, setPaymentId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // Get payment parameters from URL
                const paymentIdParam = searchParams.get('payment_id');
                const statusParam = searchParams.get('status');

                if (!paymentIdParam) {
                    throw new Error('Payment ID is missing from callback');
                }

                setPaymentId(paymentIdParam);

                // Check payment status with dLocal
                await checkPaymentStatus(paymentIdParam);

                // Determine redirect based on status
                if (statusParam === 'approved' || statusParam === 'COMPLETED') {
                    setStatus('success');
                    // Check if this is a subscription payment (order ID starts with 'sub_')
                    const isSubscriptionPayment = currentPayment?.orderId?.startsWith('sub_');

                    // Redirect to appropriate success page after a brief delay
                    setTimeout(() => {
                        if (isSubscriptionPayment) {
                            // Redirect to subscription success page
                            navigate('/dashboard/subscription/success?action=upgrade');
                        } else {
                            // Redirect to payment success page for property payments
                            navigate(`/dashboard/payments/success/${paymentIdParam}`);
                        }
                    }, 2000);
                } else if (statusParam === 'pending' || statusParam === 'PENDING') {
                    // For pending payments, stay on callback page to monitor
                    setStatus('processing');
                } else {
                    // Failed or cancelled
                    setStatus('error');
                    setError('Payment was not successful. Please try again.');
                }

            } catch (err: any) {
                console.error('Payment callback error:', err);
                setError(err.message || 'Failed to process payment callback');
                setStatus('error');
            }
        };

        handleCallback();
    }, [searchParams, checkPaymentStatus, navigate]);

    const handleRetry = () => {
        if (paymentId && currentPayment) {
            // Check if this is a subscription payment
            const isSubscriptionPayment = currentPayment.orderId?.startsWith('sub_');

            if (isSubscriptionPayment) {
                // Redirect back to subscription plans page for retry
                navigate('/dashboard/subscription/plans');
            } else {
                // Extract property ID from order for property payments
                const propertyId = currentPayment.orderId?.split('_')[1];
                if (propertyId) {
                    navigate(`/dashboard/checkout/${propertyId}`);
                } else {
                    navigate('/dashboard');
                }
            }
        } else {
            navigate('/dashboard');
        }
    };

    const handleBackToDashboard = () => {
        navigate('/dashboard');
    };

    if (status === 'processing') {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Card className="max-w-md">
                    <div className="text-center py-8">
                        <Spinner size="xl" className="mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Processing Payment...</h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            Please wait while we confirm your payment status.
                        </p>
                        {paymentId && (
                            <p className="text-sm text-gray-500 mt-4">
                                Payment ID: {paymentId}
                            </p>
                        )}
                    </div>
                </Card>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Card className="max-w-md">
                    <div className="text-center py-8">
                        <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-green-900 mb-2">
                            Payment Successful!
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            Your payment has been confirmed. Redirecting to confirmation page...
                        </p>
                        {paymentId && (
                            <p className="text-sm text-gray-500">
                                Payment ID: {paymentId}
                            </p>
                        )}
                    </div>
                </Card>
            </div>
        );
    }

    // Error state
    return (
        <div className="min-h-screen flex items-center justify-center">
            <Card className="max-w-md">
                <div className="text-center py-8">
                    <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-red-900 mb-2">
                        Payment Issue
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                        {error || 'There was an issue processing your payment callback.'}
                    </p>
                    <div className="space-y-3">
                        <Button onClick={handleRetry} className="w-full">
                            Try Payment Again
                        </Button>
                        <Button onClick={handleBackToDashboard} color="light" className="w-full">
                            Back to Dashboard
                        </Button>
                    </div>
                </div>
            </Card>
            </div>
        );
}
