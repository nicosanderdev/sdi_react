import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Button } from 'flowbite-react';
import { 
    CheckCircle, 
    ArrowRight,
    Crown,
    CreditCard
} from 'lucide-react';

export function SubscriptionSuccessPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const action = searchParams.get('action') || 'upgrade';

    useEffect(() => {
        // Auto-redirect after 5 seconds
        const timer = setTimeout(() => {
            navigate('/dashboard/subscription');
        }, 5000);

        return () => clearTimeout(timer);
    }, [navigate]);

    const getSuccessMessage = () => {
        switch (action) {
            case 'cancel':
                return {
                    title: 'Suscripción Cancelada',
                    message: 'Tu suscripción ha sido cancelada exitosamente. Mantendrás acceso hasta el final del período actual.',
                    icon: <CheckCircle className="w-16 h-16 text-green-500" />
                };
            case 'change':
                return {
                    title: 'Plan Actualizado',
                    message: 'Tu plan ha sido actualizado exitosamente. Los cambios se aplicarán en tu próxima facturación.',
                    icon: <Crown className="w-16 h-16 text-purple-500" />
                };
            case 'upgrade':
            default:
                return {
                    title: '¡Suscripción Actualizada!',
                    message: 'Tu suscripción ha sido actualizada exitosamente. Ya puedes disfrutar de todas las funciones premium.',
                    icon: <CheckCircle className="w-16 h-16 text-green-500" />
                };
        }
    };

    const successInfo = getSuccessMessage();

    return (
        <div className="max-w-2xl mx-auto p-6">
            <Card className="text-center">
                <div className="flex justify-center mb-6">
                    {successInfo.icon}
                </div>
                
                <h1 className="text-3xl font-bold text-[#1B4965] mb-4">
                    {successInfo.title}
                </h1>
                
                <p className="text-lg text-gray-600 mb-8">
                    {successInfo.message}
                </p>

                {action !== 'cancel' && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                        <div className="flex items-center justify-center space-x-2 text-green-800">
                            <CreditCard className="w-5 h-5" />
                            <span className="font-semibold">
                                Recibirás un email de confirmación con los detalles de tu suscripción
                            </span>
                        </div>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button
                        onClick={() => navigate('/dashboard/subscription')}
                        className="bg-[#1B4965] text-white"
                    >
                        Ver Mi Suscripción
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Button
                        onClick={() => navigate('/dashboard')}
                        color="gray"
                    >
                        Ir al Dashboard
                    </Button>
                </div>

                <p className="text-sm text-gray-500 mt-6">
                    Serás redirigido automáticamente en unos segundos...
                </p>
            </Card>
        </div>
    );
}

