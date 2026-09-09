import { useState } from 'react';
import { Card, Button, Spinner, Checkbox } from 'flowbite-react';
import {
    AlertTriangle,
    ArrowLeft,
    X,
    Shield,
    BarChart3,
    Building2,
    MessageSquare
} from 'lucide-react';
import subscriptionService from '../../../services/SubscriptionService';
import { SubscriptionData } from '../../../models/subscriptions/SubscriptionData';

type CancelSubscriptionPanelProps = {
    companyId: string;
    subscription: SubscriptionData;
    landingPlanName: string;
    onCancelled: (nextPlanName: string) => void;
    onBack: () => void;
};

export function CancelSubscriptionPage({
    companyId,
    subscription,
    landingPlanName,
    onCancelled,
    onBack,
}: CancelSubscriptionPanelProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [confirmed, setConfirmed] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCancel = async () => {
        if (!confirmed) {
            setError('Por favor confirma que entiendes las consecuencias');
            return;
        }

        try {
            setIsProcessing(true);
            setError(null);
            const next = await subscriptionService.cancelCompanyPlan(companyId);
            onCancelled(next.plan.name);
        } catch (err: any) {
            setError(err.message || 'Error al cancelar la suscripción');
            setIsProcessing(false);
        }
    };

    const consequences = [
        {
            icon: <Building2 className="w-6 h-6" />,
            title: 'Límites del plan gratuito',
            description: `La empresa pasará de inmediato a ${landingPlanName}. Las propiedades existentes no se despublican; las acciones nuevas usarán los límites de ese plan.`,
        },
        {
            icon: <BarChart3 className="w-6 h-6" />,
            title: 'Funciones del plan actual',
            description: 'Perderás las cuotas y beneficios del plan pago en cuanto confirmes.',
        },
        {
            icon: <MessageSquare className="w-6 h-6" />,
            title: 'Sin reembolso',
            description: 'El pago ya realizado por Mercado Pago no se reembolsa.',
        },
        {
            icon: <Shield className="w-6 h-6" />,
            title: 'Podés volver a un plan pago',
            description: 'Podés contratar otro plan de empresa más adelante desde suscripción de empresa.',
        },
    ];

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="mb-8">
                <button
                    onClick={onBack}
                    className="flex items-center space-x-2 text-gray-600 dark:text-gray-200 hover:text-gray-900 dark:hover:text-gray-400 mb-4"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span>Volver</span>
                </button>
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
                        <X className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">Cancelar suscripción de empresa</h1>
                        <p>El plan actual se reemplaza de inmediato por el plan gratuito.</p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <span className="text-red-800">{error}</span>
                </div>
            )}

            <Card className="mb-6 border-2 border-red-200 dark:border-2 dark:border-red-600 bg-red-50">
                <div className="flex items-start space-x-4">
                    <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0 mt-1" />
                    <div>
                        <h3 className="text-lg font-semibold text-red-900 dark:text-red-400 mb-2">
                            ¿Estás seguro de que quieres cancelar?
                        </h3>
                        <p className="text-red-800 dark:text-gray-100">
                            Al cancelar, la empresa pasa ahora a <strong>{landingPlanName}</strong>.
                            El cargo ya pagado no se reembolsa.
                        </p>
                    </div>
                </div>
            </Card>

            <Card className="mb-6">
                <h3 className="text-lg font-semibold mb-4">Plan actual</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Plan</p>
                        <p className="text-xl font-bold text-[#1B4965] dark:text-gray-200">{subscription.plan.name}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Precio</p>
                        <p className="text-xl font-bold text-[#1B4965] dark:text-gray-200">
                            UYU {Number(subscription.plan.monthlyPrice ?? 0).toFixed(2)}
                        </p>
                    </div>
                </div>
            </Card>

            <Card className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Lo que implica</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {consequences.map((consequence) => (
                        <div key={consequence.title} className="flex items-start space-x-3 p-3 dark:bg-gray-800 bg-gray-50 rounded-lg">
                            <div className="text-primary-500 flex-shrink-0">
                                {consequence.icon}
                            </div>
                            <div>
                                <h4 className="font-semibold text-gray-900 dark:text-gray-200 mb-1">
                                    {consequence.title}
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    {consequence.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            <Card className="mb-6 border-2 border-yellow-200 bg-yellow-50">
                <div className="flex items-center space-x-3">
                    <div className="flex items-center h-5">
                        <Checkbox
                            id="confirm-company-cancel"
                            checked={confirmed}
                            onChange={() => setConfirmed(!confirmed)}
                        />
                    </div>
                    <label htmlFor="confirm-company-cancel" className="cursor-pointer">
                        <div className="font-semibold text-yellow-900 dark:text-yellow-400 mb-1">
                            Confirmo que entiendo las consecuencias
                        </div>
                        <div className="text-sm text-yellow-800 dark:text-gray-100">
                            Entiendo que el plan pago termina ahora, que pasamos a {landingPlanName},
                            y que el pago ya realizado no se reembolsa.
                        </div>
                    </label>
                </div>
            </Card>

            <div className="flex space-x-4">
                <Button
                    onClick={onBack}
                    color="alternative"
                    className="flex-1"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Volver
                </Button>
                <Button
                    onClick={handleCancel}
                    disabled={!confirmed || isProcessing}
                    color="red"
                    className="flex-1"
                >
                    {isProcessing ? (
                        <>
                            <Spinner size="sm" className="mr-2" />
                            Cancelando...
                        </>
                    ) : (
                        <>
                            <X className="w-4 h-4 mr-2" />
                            Cancelar suscripción
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
