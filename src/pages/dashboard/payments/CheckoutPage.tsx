import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Card, Button, Spinner } from 'flowbite-react';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { PaymentForm } from '../../../components/payments/PaymentForm';
import { PaymentStatusModal } from '../../../components/payments/PaymentStatusModal';
import propertyService from '../../../services/PropertyService';
import { PropertyData } from '../../../models/properties/PropertyData';

export function CheckoutPage() {
    const navigate = useNavigate();
    const { propertyId } = useParams<{ propertyId: string }>();
    const [searchParams] = useSearchParams();
    const amount = searchParams.get('amount');
    const currency = searchParams.get('currency') || 'USD';

    const [property, setProperty] = useState<PropertyData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);

    useEffect(() => {
        const loadProperty = async () => {
            if (!propertyId) {
                setError('Property ID is required');
                setIsLoading(false);
                return;
            }

            try {
                const propertyData = await propertyService.getPropertyById(propertyId);
                setProperty(propertyData);
            } catch (err: any) {
                console.error('Error loading property:', err);
                setError('Failed to load property details');
            } finally {
                setIsLoading(false);
            }
        };

        loadProperty();
    }, [propertyId]);

    const handlePaymentSuccess = (paymentData: any) => {
        setCurrentPaymentId(paymentData.paymentId);
        setShowStatusModal(true);
    };

    const handlePaymentCancel = () => {
        navigate(`/dashboard/properties/${propertyId}`);
    };

    const handleStatusModalClose = () => {
        setShowStatusModal(false);
        setCurrentPaymentId(null);
        // Navigate back to property or dashboard
        navigate(`/dashboard/properties/${propertyId}`);
    };

    const handleStatusModalSuccess = () => {
        setShowStatusModal(false);
        // Navigate to success page
        navigate(`/dashboard/payments/success/${currentPaymentId}`);
    };

    const handleStatusModalRetry = () => {
        setShowStatusModal(false);
        setCurrentPaymentId(null);
        // Stay on checkout page to retry
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Card className="max-w-md">
                    <div className="text-center py-8">
                        <Spinner size="xl" className="mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Loading checkout...</h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            Please wait while we prepare your payment.
                        </p>
                    </div>
                </Card>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Card className="max-w-md">
                    <div className="text-center py-8">
                        <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-red-900 mb-2">
                            Checkout Error
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            {error}
                        </p>
                        <Button onClick={() => navigate('/dashboard')} className="w-full">
                            Back to Dashboard
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    const paymentAmount = amount ? parseFloat(amount) : 100; // Default amount if not specified

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={handlePaymentCancel}
                        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to Property</span>
                    </button>

                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        Checkout
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Complete your payment for this property
                    </p>
                </div>

                {/* Property Summary */}
                {property && (
                    <Card className="mb-8">
                        <div className="flex items-center space-x-4">
                            {property.images && property.images.length > 0 && (
                                <img
                                    src={property.images[0].url}
                                    alt={property.title}
                                    className="w-20 h-20 object-cover rounded-lg"
                                />
                            )}
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {property.title}
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400 text-sm">
                                    {property.location?.address || 'Address not available'}
                                </p>
                                <div className="flex items-center space-x-4 mt-2">
                                    <span className="text-sm text-gray-500">
                                        Property ID: {property.id}
                                    </span>
                                    {property.price && (
                                        <span className="text-sm font-medium text-green-600">
                                            Listed: {property.currency} {property.price.toLocaleString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold text-[#1B4965] dark:text-blue-400">
                                    {currency} {paymentAmount.toFixed(2)}
                                </div>
                                <div className="text-sm text-gray-500">
                                    Amount to pay
                                </div>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Payment Form */}
                <PaymentForm
                    propertyId={propertyId}
                    amount={paymentAmount}
                    currency={currency}
                    onSuccess={handlePaymentSuccess}
                    onCancel={handlePaymentCancel}
                    orderId={`order_${propertyId}_${Date.now()}`}
                />

                {/* Payment Status Modal */}
                <PaymentStatusModal
                    isOpen={showStatusModal}
                    paymentId={currentPaymentId}
                    onClose={handleStatusModalClose}
                    onSuccess={handleStatusModalSuccess}
                    onRetry={handleStatusModalRetry}
                />
            </div>
        </div>
    );
}
