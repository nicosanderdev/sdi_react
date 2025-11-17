import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store/store';
import { Card, Button, Spinner, Checkbox } from 'flowbite-react';
import { 
    AlertTriangle, 
    ArrowLeft,
    X,
    CheckCircle,
    Shield,
    BarChart3,
    Building2,
    MessageSquare
} from 'lucide-react';
import subscriptionService from '../../../services/SubscriptionService';
import { SubscriptionData } from '../../../models/subscriptions/SubscriptionData';
import { CancelSubscriptionRequest } from '../../../models/subscriptions/CancelSubscriptionRequest';

export function CancelSubscriptionPage() {
    const user = useSelector((state: RootState) => state.user.profile);
    const navigate = useNavigate();
    const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [cancelImmediately, setCancelImmediately] = useState(false);
    const [confirmed, setConfirmed] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchSubscription = async () => {
            try {
                setIsLoading(true);
                const data = await subscriptionService.getCurrentSubscription();
                setSubscription(data);
            } catch (err: any) {
                setError(err.message || 'Error al cargar la suscripción');
            } finally {
                setIsLoading(false);
            }
        };
        fetchSubscription();
    }, []);

    const handleCancel = async () => {
        if (!confirmed) {
            setError('Por favor confirma que entiendes las consecuencias');
            return;
        }

        try {
            setIsProcessing(true);
            setError(null);
            const request: CancelSubscriptionRequest = {
                CancelImmediately: cancelImmediately
            };
            await subscriptionService.cancelSubscription(request);
            navigate('/dashboard/subscription/success?action=cancel');
        } catch (err: any) {
            setError(err.message || 'Error al cancelar la suscripción');
            setIsProcessing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Spinner size="xl" />
            </div>
        );
    }

    if (!subscription) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <Card>
                    <div className="text-center py-8">
                        <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">No tienes una suscripción activa</h3>
                        <Button onClick={() => navigate('/dashboard/subscription')}>
                            Volver a Suscripción
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    const consequences = [
        {
            icon: <Building2 className="w-6 h-6" />,
            title: 'Pérdida de Acceso a Propiedades',
            description: 'No podrás gestionar más de las propiedades permitidas en el plan gratuito.'
        },
        {
            icon: <BarChart3 className="w-6 h-6" />,
            title: 'Reportes Limitados',
            description: 'Los reportes avanzados y métricas detalladas ya no estarán disponibles.'
        },
        {
            icon: <MessageSquare className="w-6 h-6" />,
            title: 'Funciones Premium',
            description: 'Perderás acceso a todas las funciones premium del plan actual.'
        },
        {
            icon: <Shield className="w-6 h-6" />,
            title: 'Soporte Prioritario',
            description: 'El soporte prioritario se reducirá al soporte estándar.'
        }
    ];

    return (
        <div className="max-w-4xl mx-auto p-6">
            {/* Header */}
            <div className="mb-8">
                <button
                    onClick={() => navigate('/dashboard/subscription')}
                    className="flex items-center space-x-2 text-gray-600 dark:text-gray-200 hover:text-gray-900 dark:hover:text-gray-400 mb-4"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span>Volver a Suscripción</span>
                </button>
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
                        <X className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">Cancelar Suscripción</h1>
                        <p>Estamos tristes de verte partir</p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <span className="text-red-800">{error}</span>
                </div>
            )}

            {/* Warning Card */}
            <Card className="mb-6 border-2 border-red-200 dark:border-2 dark:border-red-600 bg-red-50">
                <div className="flex items-start space-x-4">
                    <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0 mt-1" />
                    <div>
                        <h3 className="text-lg font-semibold text-red-900 dark:text-red-400 mb-2">
                            ¿Estás seguro de que quieres cancelar?
                        </h3>
                        <p className="text-red-800 dark:text-gray-100">
                            Al cancelar tu suscripción, perderás acceso a todas las funciones premium 
                            y se aplicará un downgrade al plan gratuito.
                        </p>
                    </div>
                </div>
            </Card>

            {/* Current Plan Info */}
            <Card className="mb-6">
                <h3 className="text-lg font-semibold mb-4">Tu Plan Actual</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Plan</p>
                        <p className="text-xl font-bold text-[#1B4965] dark:text-gray-200">{subscription.plan.name}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Próxima Facturación</p>
                        <p className="text-xl font-bold text-[#1B4965] dark:text-gray-200">
                            {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-ES')}
                        </p>
                    </div>
                </div>
            </Card>

            {/* Consequences */}
            <Card className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Lo que perderás</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {consequences.map((consequence, index) => (
                        <div key={index} className="flex items-start space-x-3 p-3 dark:bg-gray-800 bg-gray-50 rounded-lg">
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
            
            {/* Confirmation */}
            <Card className="mb-6 border-2 border-yellow-200 bg-yellow-50">
                <div className="flex items-center space-x-3">
                    <div className="flex items-center h-5">
                        <Checkbox
                            id="confirm"
                            checked={confirmed}
                            onChange={() => setConfirmed(!confirmed)}
                        />
                    </div>
                    <label htmlFor="confirm" className="cursor-pointer">
                        <div className="font-semibold text-yellow-900 dark:text-yellow-400 mb-1">
                            Confirmo que entiendo las consecuencias
                        </div>
                        <div className="text-sm text-yellow-800 dark:text-gray-100">
                            Entiendo que al cancelar perderé acceso a las funciones premium y 
                            mi cuenta será degradada al plan gratuito.
                        </div>
                    </label>
                </div>
            </Card>

            {/* Action Buttons */}
            <div className="flex space-x-4">
                <Button
                    onClick={() => navigate('/dashboard/subscription')}
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
                            Cancelar Suscripción
                        </>
                    )}
                </Button>
            </div>

            {/* Help Text */}
            <div className="mt-6 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-200">
                    ¿Necesitas ayuda? <a href="/contact" className="text-[#1B4965] dark:text-blue-500    hover:underline">Contacta con soporte</a>
                </p>
            </div>
        </div>
    );
}

