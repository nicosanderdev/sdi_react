import React, { useState, useEffect } from 'react';
import { Card, Button, Select } from 'flowbite-react';
import { CreditCard, Smartphone, Building2 } from 'lucide-react';
import paymentService from '../../services/PaymentService';

export interface PaymentMethod {
    id: string;
    name: string;
    type: 'card' | 'bank_transfer' | 'digital_wallet';
    icon: React.ReactNode;
    description: string;
    countries?: string[];
}

interface PaymentMethodSelectorProps {
    selectedMethod: string;
    onMethodChange: (methodId: string) => void;
    currency?: string;
    country?: string;
}

const AVAILABLE_METHODS: PaymentMethod[] = [
    {
        id: 'card',
        name: 'Credit/Debit Card',
        type: 'card',
        icon: <CreditCard className="w-5 h-5" />,
        description: 'Visa, Mastercard, American Express'
    },
    {
        id: 'bank_transfer',
        name: 'Bank Transfer',
        type: 'bank_transfer',
        icon: <Building2 className="w-5 h-5" />,
        description: 'Direct bank transfer (ACH, Wire)'
    },
    {
        id: 'digital_wallet',
        name: 'Digital Wallet',
        type: 'digital_wallet',
        icon: <Smartphone className="w-5 h-5" />,
        description: 'PayPal, Apple Pay, Google Pay'
    }
];

export function PaymentMethodSelector({
    selectedMethod,
    onMethodChange,
    currency = 'USD',
    country = 'US'
}: PaymentMethodSelectorProps) {
    const [availableMethods, setAvailableMethods] = useState<PaymentMethod[]>(AVAILABLE_METHODS);
    const [isLoading, setIsLoading] = useState(false);

    // Load payment methods from dLocal API
    useEffect(() => {
        const loadPaymentMethods = async () => {
            try {
                setIsLoading(true);
                // Try to get methods from dLocal API
                const methods = await paymentService.getPaymentMethods(country);
                if (methods && methods.length > 0) {
                    // Transform dLocal methods to our format
                    const transformedMethods = methods.map((method: any) => ({
                        id: method.id,
                        name: method.name,
                        type: method.type,
                        icon: getMethodIcon(method.type),
                        description: method.description || method.name,
                        countries: method.countries
                    }));
                    setAvailableMethods(transformedMethods);
                }
            } catch (error) {
                // Fall back to default methods if API fails
                console.warn('Failed to load payment methods from API, using defaults:', error);
                setAvailableMethods(AVAILABLE_METHODS);
            } finally {
                setIsLoading(false);
            }
        };

        loadPaymentMethods();
    }, [country]);

    const getMethodIcon = (type: string) => {
        switch (type) {
            case 'card':
                return <CreditCard className="w-5 h-5" />;
            case 'bank_transfer':
                return <Building2 className="w-5 h-5" />;
            case 'digital_wallet':
                return <Smartphone className="w-5 h-5" />;
            default:
                return <CreditCard className="w-5 h-5" />;
        }
    };

    const handleMethodSelect = (methodId: string) => {
        onMethodChange(methodId);
    };

    if (isLoading) {
        return (
            <div className="space-y-3">
                <h3 className="text-lg font-semibold">Select Payment Method</h3>
                <div className="animate-pulse space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-semibold mb-3">Select Payment Method</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Choose how you'd like to pay for this transaction
                </p>
            </div>

            <div className="space-y-3">
                {availableMethods.map((method) => (
                    <Card
                        key={method.id}
                        className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                            selectedMethod === method.id
                                ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                        onClick={() => handleMethodSelect(method.id)}
                    >
                        <div className="flex items-center space-x-4 p-2">
                            <div className={`p-2 rounded-lg ${
                                selectedMethod === method.id
                                    ? 'bg-blue-100 dark:bg-blue-800 text-blue-600'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600'
                            }`}>
                                {method.icon}
                            </div>

                            <div className="flex-1">
                                <h4 className="font-medium text-gray-900 dark:text-white">
                                    {method.name}
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {method.description}
                                </p>
                            </div>

                            <div className={`w-4 h-4 rounded-full border-2 ${
                                selectedMethod === method.id
                                    ? 'border-blue-500 bg-blue-500'
                                    : 'border-gray-300 dark:border-gray-600'
                            }`}>
                                {selectedMethod === method.id && (
                                    <div className="w-full h-full rounded-full bg-white scale-50"></div>
                                )}
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Currency and country info */}
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                <p>Payment in {currency} • Available in {country}</p>
                {paymentService.isSandbox && (
                    <p className="text-orange-600 dark:text-orange-400 mt-1">
                        ⚠️ Sandbox mode - No real payments will be processed
                    </p>
                )}
            </div>
        </div>
    );
}
