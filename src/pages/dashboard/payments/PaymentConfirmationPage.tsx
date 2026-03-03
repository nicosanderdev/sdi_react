import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Button, Spinner } from 'flowbite-react';
import {
    CheckCircle,
    Download,
    Mail,
    ArrowRight,
    AlertTriangle,
    RefreshCw
} from 'lucide-react';
import { usePayment } from '../../../contexts/PaymentContext';
import { PaymentStatus } from '../../../models/payments/PaymentData';

export function PaymentConfirmationPage() {
    const navigate = useNavigate();
    const { paymentId } = useParams<{ paymentId: string }>();
    const { checkPaymentStatus, isProcessing, currentPayment } = usePayment();

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadPaymentDetails = async () => {
            if (!paymentId) {
                setError('Payment ID is required');
                setIsLoading(false);
                return;
            }

            try {
                await checkPaymentStatus(paymentId);
            } catch (err: any) {
                console.error('Error loading payment details:', err);
                setError('Failed to load payment details');
            } finally {
                setIsLoading(false);
            }
        };

        loadPaymentDetails();
    }, [paymentId, checkPaymentStatus]);

    const handleViewProperty = () => {
        // Check if this is a subscription payment
        const isSubscriptionPayment = currentPayment?.orderId?.startsWith('sub_');

        if (isSubscriptionPayment) {
            // For subscription payments, redirect to subscription management
            navigate('/dashboard/subscription');
        } else {
            // Extract property ID from order ID if available for property payments
            if (currentPayment?.orderId) {
                const propertyId = currentPayment.orderId.split('_')[1];
                if (propertyId) {
                    navigate(`/dashboard/properties/${propertyId}`);
                    return;
                }
            }
            navigate('/dashboard/properties');
        }
    };

    const handleViewAllPayments = () => {
        navigate('/dashboard/payments');
    };

    const handleDownloadReceipt = () => {
        // TODO: Implement receipt download functionality
        console.log('Download receipt for payment:', paymentId);
        // This would typically call a backend endpoint to generate and download a PDF receipt
    };

    const handleEmailReceipt = () => {
        // TODO: Implement email receipt functionality
        console.log('Email receipt for payment:', paymentId);
        // This would typically trigger an email with the receipt
    };

    const handleRetryCheck = async () => {
        if (!paymentId) return;

        try {
            setError(null);
            await checkPaymentStatus(paymentId);
        } catch (err: any) {
            setError('Failed to refresh payment status');
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Card className="max-w-md">
                    <div className="text-center py-8">
                        <Spinner size="xl" className="mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Loading payment details...</h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            Please wait while we fetch your payment information.
                        </p>
                    </div>
                </Card>
            </div>
        );
    }

    if (error || !currentPayment) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Card className="max-w-md">
                    <div className="text-center py-8">
                        <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-red-900 mb-2">
                            Unable to Load Payment
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            {error || 'Payment details could not be found.'}
                        </p>
                        <div className="space-y-3">
                            <Button onClick={handleRetryCheck} className="w-full" disabled={isProcessing}>
                                {isProcessing ? (
                                    <>
                                        <Spinner size="sm" className="mr-2" />
                                        Retrying...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                        Try Again
                                    </>
                                )}
                            </Button>
                            <Button onClick={() => navigate('/dashboard')} color="light" className="w-full">
                                Back to Dashboard
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    const isSuccess = currentPayment.status === PaymentStatus.APPROVED;
    const isPending = currentPayment.status === PaymentStatus.PENDING;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Success/Pending Header */}
                <Card className="mb-8">
                    <div className="text-center py-8">
                        {isSuccess ? (
                            <>
                                <CheckCircle className="w-20 h-20 text-green-600 mx-auto mb-4" />
                                <h1 className="text-3xl font-bold text-green-900 mb-2">
                                    Payment Successful!
                                </h1>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Your payment has been processed successfully. You will receive a confirmation email shortly.
                                </p>
                            </>
                        ) : isPending ? (
                            <>
                                <div className="w-20 h-20 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <RefreshCw className="w-10 h-10 text-blue-600" />
                                </div>
                                <h1 className="text-3xl font-bold text-blue-900 mb-2">
                                    Payment Processing
                                </h1>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Your payment is being processed. This may take a few moments.
                                </p>
                            </>
                        ) : (
                            <>
                                <AlertTriangle className="w-20 h-20 text-red-600 mx-auto mb-4" />
                                <h1 className="text-3xl font-bold text-red-900 mb-2">
                                    Payment Issue
                                </h1>
                                <p className="text-gray-600 dark:text-gray-400">
                                    There was an issue with your payment. Please contact support if this persists.
                                </p>
                            </>
                        )}
                    </div>
                </Card>

                {/* Payment Details */}
                <Card className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">Payment Details</h2>
                    <div className="space-y-3">
                        <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                            <span className="font-medium">Payment ID</span>
                            <span className="font-mono text-sm">{currentPayment.id}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                            <span className="font-medium">Order ID</span>
                            <span className="font-mono text-sm">{currentPayment.orderId}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                            <span className="font-medium">Amount</span>
                            <span className="font-semibold">
                                {currentPayment.currency} {currentPayment.amount.toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                            <span className="font-medium">Status</span>
                            <span className={`capitalize px-2 py-1 rounded text-sm ${
                                currentPayment.status === PaymentStatus.APPROVED
                                    ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200'
                                    : currentPayment.status === PaymentStatus.PENDING
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200'
                                    : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200'
                            }`}>
                                {currentPayment.status}
                            </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                            <span className="font-medium">Date</span>
                            <span>{currentPayment.createdAt.toLocaleDateString()}</span>
                        </div>
                        {currentPayment.transactionDetails?.providerPaymentId && (
                            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                                <span className="font-medium">Transaction ID</span>
                                <span className="font-mono text-sm">{currentPayment.transactionDetails.providerPaymentId}</span>
                            </div>
                        )}
                        <div className="flex justify-between py-2">
                            <span className="font-medium">Customer</span>
                            <span>{currentPayment.customerInfo.name}</span>
                        </div>
                    </div>
                </Card>

                {/* Action Buttons */}
                <div className="space-y-4">
                    {isSuccess && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Button onClick={handleDownloadReceipt} color="light" className="w-full">
                                <Download className="w-4 h-4 mr-2" />
                                Download Receipt
                            </Button>
                            <Button onClick={handleEmailReceipt} color="light" className="w-full">
                                <Mail className="w-4 h-4 mr-2" />
                                Email Receipt
                            </Button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Button onClick={handleViewProperty} color="light" className="w-full">
                            <ArrowRight className="w-4 h-4 mr-2" />
                            {currentPayment?.orderId?.startsWith('sub_') ? 'View Subscription' : 'View Property'}
                        </Button>
                        <Button onClick={handleViewAllPayments} className="w-full">
                            View All Payments
                        </Button>
                    </div>

                    <div className="text-center">
                        <Button onClick={() => navigate('/dashboard')} color="light">
                            Back to Dashboard
                        </Button>
                    </div>
                </div>

                {/* Support Information */}
                <Card className="mt-8 bg-blue-50 dark:bg-blue-900/20">
                    <div className="text-center">
                        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                            Need Help?
                        </h3>
                        <p className="text-blue-800 dark:text-blue-200 text-sm mb-3">
                            If you have any questions about your payment or need assistance, our support team is here to help.
                        </p>
                        <Button size="sm" color="light">
                            Contact Support
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
}
