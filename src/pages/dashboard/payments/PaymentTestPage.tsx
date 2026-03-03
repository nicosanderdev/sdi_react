import React, { useState } from 'react';
import { Card, Button, Alert } from 'flowbite-react';
import { TestTube, CreditCard, AlertTriangle, CheckCircle } from 'lucide-react';
import { PaymentForm } from '../../../components/payments/PaymentForm';
import { PaymentStatusModal } from '../../../components/payments/PaymentStatusModal';
import paymentService from '../../../services/PaymentService';

export function PaymentTestPage() {
    const [showTestForm, setShowTestForm] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<string[]>([]);

    const addTestResult = (result: string) => {
        setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
    };

    const handlePaymentSuccess = (paymentData: any) => {
        setCurrentPaymentId(paymentData.paymentId);
        setShowStatusModal(true);
        addTestResult(`Payment created successfully: ${paymentData.paymentId}`);
    };

    const handleStatusModalClose = () => {
        setShowStatusModal(false);
        setCurrentPaymentId(null);
    };

    const handleStatusModalSuccess = () => {
        setShowStatusModal(false);
        addTestResult('Payment confirmed as successful');
    };

    const handleStatusModalRetry = () => {
        setShowStatusModal(false);
        setCurrentPaymentId(null);
        addTestResult('Payment retry initiated');
    };

    const runConfigurationTest = () => {
        const isConfigured = paymentService.validateConfiguration();
        const environment = paymentService.isSandbox ? 'sandbox' : 'production';

        if (isConfigured) {
            addTestResult(`✅ Configuration valid - using ${environment} environment`);
        } else {
            addTestResult('❌ Configuration invalid - check environment variables');
        }
    };

    const testCards = [
        { number: '4111111111111111', description: 'Success card', expected: 'approved' },
        { number: '5555555555554444', description: 'Decline card', expected: 'declined' },
        { number: '4000000000000002', description: 'Another test card', expected: 'approved' }
    ];

    if (!showTestForm) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-4 flex items-center">
                        <TestTube className="w-8 h-8 mr-3 text-blue-600" />
                        dLocal Payment Gateway Test
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Test the dLocal Go payment integration in sandbox mode
                    </p>
                </div>

                {/* Configuration Status */}
                <Card className="mb-6">
                    <h2 className="text-xl font-semibold mb-4">Configuration Status</h2>
                    <div className="flex items-center space-x-4 mb-4">
                        <Button onClick={runConfigurationTest} color="light">
                            Test Configuration
                        </Button>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                            Environment: {paymentService.isSandbox ? 'Sandbox' : 'Production'}
                        </div>
                    </div>
                    {testResults.length > 0 && (
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                            <h3 className="font-medium mb-2">Test Results:</h3>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                                {testResults.map((result, index) => (
                                    <div key={index} className="text-sm font-mono">
                                        {result}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>

                {/* Test Cards Reference */}
                <Card className="mb-6">
                    <h2 className="text-xl font-semibold mb-4">Test Cards</h2>
                    <Alert color="info" className="mb-4">
                        <div className="flex items-center">
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            <span>These cards only work in sandbox mode</span>
                        </div>
                    </Alert>
                    <div className="space-y-3">
                        {testCards.map((card, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <div className="flex items-center space-x-3">
                                    <CreditCard className="w-5 h-5 text-gray-600" />
                                    <div>
                                        <div className="font-mono text-sm">{card.number}</div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">{card.description}</div>
                                    </div>
                                </div>
                                <div className={`px-2 py-1 rounded text-xs ${
                                    card.expected === 'approved'
                                        ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200'
                                        : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200'
                                }`}>
                                    {card.expected}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Start Test Button */}
                <Card>
                    <div className="text-center">
                        <h2 className="text-xl font-semibold mb-4">Start Payment Test</h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Test the complete payment flow with dLocal Go
                        </p>
                        <Button
                            onClick={() => setShowTestForm(true)}
                            size="lg"
                            className="px-8"
                        >
                            <TestTube className="w-5 h-5 mr-2" />
                            Start Payment Test
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="mb-8">
                <button
                    onClick={() => setShowTestForm(false)}
                    className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4"
                >
                    ← Back to Test Overview
                </button>
                <h1 className="text-3xl font-bold mb-4">Payment Test Form</h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Test payment processing with dLocal Go sandbox
                </p>
            </div>

            <PaymentForm
                propertyId="test-property-123"
                amount={99.99}
                currency="USD"
                onSuccess={handlePaymentSuccess}
                onCancel={() => setShowTestForm(false)}
                orderId={`test_order_${Date.now()}`}
            />

            {/* Payment Status Modal */}
            <PaymentStatusModal
                isOpen={showStatusModal}
                paymentId={currentPaymentId}
                onClose={handleStatusModalClose}
                onSuccess={handleStatusModalSuccess}
                onRetry={handleStatusModalRetry}
            />

            {/* Test Results */}
            {testResults.length > 0 && (
                <Card className="mt-6">
                    <h3 className="font-semibold mb-3">Test Results</h3>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                        {testResults.map((result, index) => (
                            <div key={index} className="text-sm font-mono bg-gray-50 dark:bg-gray-800 p-2 rounded">
                                {result}
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
}
