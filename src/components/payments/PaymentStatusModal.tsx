import React, { useEffect, useState } from 'react';
import { Modal, ModalBody, ModalHeader, Button, Spinner } from 'flowbite-react';
import {
    CheckCircle,
    AlertTriangle,
    Clock,
    X,
    RefreshCw,
    ExternalLink
} from 'lucide-react';
import { usePayment } from '../../contexts/PaymentContext';
import { PaymentStatus } from '../../models/payments/PaymentData';

interface PaymentStatusModalProps {
    isOpen: boolean;
    paymentId: string | null;
    onClose: () => void;
    onRetry?: () => void;
    onSuccess?: () => void;
}

export function PaymentStatusModal({
    isOpen,
    paymentId,
    onClose,
    onRetry,
    onSuccess
}: PaymentStatusModalProps) {
    const { checkPaymentStatus, isProcessing, error, currentPayment } = usePayment();
    const [isChecking, setIsChecking] = useState(false);
    const [checkCount, setCheckCount] = useState(0);
    const maxChecks = 10; // Maximum number of status checks

    useEffect(() => {
        if (isOpen && paymentId && !isChecking) {
            checkStatus();
        }
    }, [isOpen, paymentId]);

    // Auto-check status for pending payments
    useEffect(() => {
        if (currentPayment?.status === PaymentStatus.PENDING && checkCount < maxChecks && isOpen) {
            const timer = setTimeout(() => {
                checkStatus();
            }, 3000); // Check every 3 seconds

            return () => clearTimeout(timer);
        }
    }, [currentPayment, checkCount, isOpen]);

    const checkStatus = async () => {
        if (!paymentId || isChecking) return;

        try {
            setIsChecking(true);
            await checkPaymentStatus(paymentId);
            setCheckCount(prev => prev + 1);

            // Call success callback if payment is approved
            if (currentPayment?.status === PaymentStatus.APPROVED) {
                onSuccess?.();
            }
        } catch (err) {
            console.error('Error checking payment status:', err);
        } finally {
            setIsChecking(false);
        }
    };

    const getStatusIcon = (status: PaymentStatus | undefined) => {
        switch (status) {
            case PaymentStatus.APPROVED:
                return <CheckCircle className="w-12 h-12 text-green-600" />;
            case PaymentStatus.DECLINED:
            case PaymentStatus.CANCELLED:
                return <AlertTriangle className="w-12 h-12 text-red-600" />;
            case PaymentStatus.PENDING:
                return <Clock className="w-12 h-12 text-blue-600" />;
            case PaymentStatus.REFUNDED:
                return <RefreshCw className="w-12 h-12 text-orange-600" />;
            default:
                return <Clock className="w-12 h-12 text-gray-600" />;
        }
    };

    const getStatusTitle = (status: PaymentStatus | undefined) => {
        switch (status) {
            case PaymentStatus.APPROVED:
                return 'Payment Successful!';
            case PaymentStatus.DECLINED:
                return 'Payment Declined';
            case PaymentStatus.CANCELLED:
                return 'Payment Cancelled';
            case PaymentStatus.PENDING:
                return 'Processing Payment...';
            case PaymentStatus.REFUNDED:
                return 'Payment Refunded';
            default:
                return 'Checking Payment Status...';
        }
    };

    const getStatusMessage = (status: PaymentStatus | undefined) => {
        switch (status) {
            case PaymentStatus.APPROVED:
                return 'Your payment has been processed successfully. You will receive a confirmation email shortly.';
            case PaymentStatus.DECLINED:
                return 'Your payment was declined. Please check your payment information or try a different payment method.';
            case PaymentStatus.CANCELLED:
                return 'Your payment was cancelled. No charges have been made to your account.';
            case PaymentStatus.PENDING:
                return checkCount >= maxChecks
                    ? 'We\'re still processing your payment. Please check back later or contact support if you don\'t receive confirmation within 24 hours.'
                    : 'Please wait while we confirm your payment...';
            case PaymentStatus.REFUNDED:
                return 'Your payment has been refunded. The amount will be returned to your original payment method.';
            default:
                return 'We\'re checking the status of your payment. This may take a few moments.';
        }
    };

    const getStatusColor = (status: PaymentStatus | undefined) => {
        switch (status) {
            case PaymentStatus.APPROVED:
                return 'text-green-900';
            case PaymentStatus.DECLINED:
            case PaymentStatus.CANCELLED:
                return 'text-red-900';
            case PaymentStatus.PENDING:
                return 'text-blue-900';
            case PaymentStatus.REFUNDED:
                return 'text-orange-900';
            default:
                return 'text-gray-900';
        }
    };

    const canRetry = currentPayment?.status === PaymentStatus.DECLINED ||
                     currentPayment?.status === PaymentStatus.CANCELLED ||
                     (currentPayment?.status === PaymentStatus.PENDING && checkCount >= maxChecks);

    const showManualCheck = currentPayment?.status === PaymentStatus.PENDING && checkCount < maxChecks;

    return (
        <Modal
            show={isOpen}
            onClose={onClose}
            size="md"
            dismissible={currentPayment?.status === PaymentStatus.APPROVED}
        >
            <ModalHeader>
                Payment Status
            </ModalHeader>

            <ModalBody>
                <div className="text-center py-6">
                    {/* Status Icon */}
                    <div className="flex justify-center mb-4">
                        {isChecking ? (
                            <Spinner size="xl" />
                        ) : (
                            getStatusIcon(currentPayment?.status)
                        )}
                    </div>

                    {/* Status Title */}
                    <h3 className={`text-xl font-bold mb-3 ${getStatusColor(currentPayment?.status)}`}>
                        {isChecking ? 'Checking Status...' : getStatusTitle(currentPayment?.status)}
                    </h3>

                    {/* Status Message */}
                    <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-sm mx-auto">
                        {isChecking ? 'Please wait...' : getStatusMessage(currentPayment?.status)}
                    </p>

                    {/* Payment Details */}
                    {currentPayment && (
                        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-6 text-left max-w-sm mx-auto">
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="font-medium">Payment ID:</span>
                                    <span className="font-mono text-xs">{currentPayment.id}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-medium">Amount:</span>
                                    <span>{currentPayment.currency} {currentPayment.amount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-medium">Status:</span>
                                    <span className={`capitalize ${
                                        currentPayment.status === PaymentStatus.APPROVED ? 'text-green-600' :
                                        currentPayment.status === PaymentStatus.DECLINED ? 'text-red-600' :
                                        currentPayment.status === PaymentStatus.PENDING ? 'text-blue-600' :
                                        'text-gray-600'
                                    }`}>
                                        {currentPayment.status}
                                    </span>
                                </div>
                                {currentPayment.orderId && (
                                    <div className="flex justify-between">
                                        <span className="font-medium">Order ID:</span>
                                        <span className="font-mono text-xs">{currentPayment.orderId}</span>
                                    </div>
                                )}
                                {currentPayment.transactionDetails?.providerPaymentId && (
                                    <div className="flex justify-between">
                                        <span className="font-medium">Transaction ID:</span>
                                        <span className="font-mono text-xs">{currentPayment.transactionDetails.providerPaymentId}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Error Display */}
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg mb-4 max-w-sm mx-auto">
                            <p className="text-red-800 dark:text-red-200 text-sm">
                                {error}
                            </p>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="space-y-3">
                        {showManualCheck && (
                            <Button
                                onClick={checkStatus}
                                disabled={isChecking}
                                className="w-full max-w-sm"
                                color="light"
                            >
                                {isChecking ? (
                                    <>
                                        <Spinner size="sm" className="mr-2" />
                                        Checking...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                        Check Status Manually
                                    </>
                                )}
                            </Button>
                        )}

                        {canRetry && onRetry && (
                            <Button
                                onClick={onRetry}
                                className="w-full max-w-sm"
                            >
                                Try Payment Again
                            </Button>
                        )}

                        <Button
                            onClick={onClose}
                            color={currentPayment?.status === PaymentStatus.APPROVED ? "success" : "light"}
                            className="w-full max-w-sm"
                        >
                            {currentPayment?.status === PaymentStatus.APPROVED ? (
                                <>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Done
                                </>
                            ) : (
                                <>
                                    <X className="w-4 h-4 mr-2" />
                                    Close
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Check Counter for Pending Payments */}
                    {currentPayment?.status === PaymentStatus.PENDING && checkCount > 0 && (
                        <p className="text-xs text-gray-500 mt-4">
                            Checked {checkCount} of {maxChecks} times
                        </p>
                    )}
                </div>
            </ModalBody>
        </Modal>
    );
}
