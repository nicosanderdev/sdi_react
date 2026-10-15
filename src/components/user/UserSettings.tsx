import { useState, useEffect } from 'react';
import { ShieldCheck, ShieldOff, Loader2, Trash2, MailCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ActionType, TwoFactorAuthModal, TwoFactorStep } from './2FaModal';
import AuthService from '../../services/AuthService';
import { Button, Card } from 'flowbite-react';

export function UserSettings() {
    const [isEmailConfirmed, setIsEmailConfirmed] = useState<boolean>(false);
    const [isPhoneVerified, setIsPhoneVerified] = useState<boolean>(false);
    const [is2faEnabled, setIs2faEnabled] = useState<boolean>(false);

    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isResendingEmail, setIsResendingEmail] = useState<boolean>(false);
    const [settingsError, setSettingsError] = useState<string | null>(null);

    const [modalStep, setModalStep] = useState<TwoFactorStep>('password');
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [modalAction, setModalAction] = useState<ActionType>('enable');
    const [isModalSubmitting, setIsModalSubmitting] = useState<boolean>(false);
    const [modalError, setModalError] = useState<string | null>(null);
    const [challengeId, setChallengeId] = useState<string | null>(null);

    useEffect(() => {
        const fetchUserSettings = async () => {
            setIsLoading(true);
            try {
                const userSettings = await AuthService.getUserSettings();
                if (!userSettings) {
                    throw new Error('No se pudieron cargar los ajustes');
                }

                setIsEmailConfirmed(userSettings.emailConfirmed);
                setIsPhoneVerified(userSettings.phoneVerified);
                setIs2faEnabled(userSettings.twoFactorEnabled);
            } catch (error) {
                console.error("Failed to fetch user settings:", error);
                setSettingsError('No se pudieron cargar los ajustes de seguridad.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserSettings();
    }, []);


    const handleInitiate2fa = () => {
        setSettingsError(null);
        if (!is2faEnabled && !isPhoneVerified) {
            setSettingsError('Verificá tu teléfono en el perfil antes de habilitar la autenticación en dos pasos.');
            return;
        }
        setModalAction(is2faEnabled ? 'disable' : 'enable');
        setModalStep('password');
        setChallengeId(null);
        setModalError(null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setModalError(null);
        setIsModalSubmitting(false);
        setChallengeId(null);
    };

    const handlePasswordSubmit = async (password: string): Promise<void> => {
        setIsModalSubmitting(true);
        setModalError(null);

        try {
            const passwordCheck = await AuthService.confirmPassword(password);
            if (!passwordCheck.success) {
                setModalError('La contraseña es incorrecta. Por favor, inténtalo de nuevo.');
                return;
            }

            const sendResult = await AuthService.sendSettings2faCode();
            setChallengeId(sendResult.challengeId);
            setModalStep('code');
        } catch (error: any) {
            console.error("Password verification / send 2FA failed:", error);
            setModalError(error.message || 'Ocurrió un error inesperado. Por favor, inténtalo de nuevo.');
        } finally {
            setIsModalSubmitting(false);
        }
    };

    const handleCodeSubmit = async (code: string): Promise<void> => {
        if (!challengeId) {
            setModalError('El desafío de verificación expiró. Cerrá el modal e intentá de nuevo.');
            return;
        }

        setIsModalSubmitting(true);
        setModalError(null);
        try {
            const enabled = modalAction === 'enable';
            const response = await AuthService.confirmSettings2fa(challengeId, code, enabled);
            setIs2faEnabled(response.twoFactorEnabled);
            setModalStep('success');
        } catch (error: any) {
            console.error(`Error during 2FA ${modalAction}:`, error);
            setModalError(error.message || 'El código de verificación es inválido o ha expirado.');
        } finally {
            setIsModalSubmitting(false);
        }
    };

    const handleResendConfirmationEmail = async () => {
        setIsResendingEmail(true);
        try {
            await AuthService.resendConfirmationEmail();
        } catch (error) {
            console.error("Failed to resend confirmation email:", error);
        } finally {
            setIsResendingEmail(false);
        }
    };

    const handleDeleteAccount = (): void => {
        if (window.confirm("¿Estás seguro de que quieres eliminar tu cuenta permanentemente? Esta acción no se puede deshacer.")) {
            console.log("Initiating account deletion...");
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="animate-spin h-8 w-8 text-[#62B6CB]" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6">
            <h1 className="text-2xl font-bold mb-6">Configuración</h1>

            <div className="space-y-8">
                <Card className="max-w-4xl">
                    <h2 className="text-lg font-semibold mb-1 text-yellow-500">Seguridad</h2>
                    <p className="text-sm mb-6">Gestiona la seguridad de tu cuenta.</p>

                    {!isEmailConfirmed ? (
                        <div className="flex flex-col md:flex-row justify-between items-center p-4 border rounded-lg dark:bg-gray-800 bg-amber-50 border-amber-200">
                        <div>
                            <p className="font-medium ">Verificación de email</p>
                            <p className="text-sm mt-1">Verifica tu correo para poder acceder a todas las funcionalidades de la aplicación.</p>
                        </div>
                        <Button
                                onClick={handleResendConfirmationEmail}
                                disabled={isResendingEmail}
                                size="sm"
                                color="yellow"
                            >
                                {isResendingEmail ? (
                                    <>
                                        <Loader2 size={16} className="mr-2 animate-spin" />
                                        Enviando...
                                    </>
                                ) : (
                                    <>
                                        <MailCheck size={16} className="mr-2" />
                            Reenviar correo
                                    </>
                                )}
                        </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                        {settingsError && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                {settingsError}{' '}
                                {!isPhoneVerified && (
                                    <Link to="/dashboard/profile" className="font-semibold underline">
                                        Ir al perfil
                                    </Link>
                                )}
                            </div>
                        )}
                        <div className="flex flex-col md:flex-row justify-between items-center p-4 border rounded-lg">
                        <div>
                            <p className="font-medium">Autenticación de dos factores (2FA)</p>
                            <p className="text-sm mt-1">
                                Añade una capa extra de seguridad: al iniciar sesión te enviaremos un código de 6 dígitos por WhatsApp.
                            </p>
                        </div>
                        <button
                                onClick={handleInitiate2fa}
                            className={`mt-4 md:mt-0 px-4 py-2 rounded-md transition-colors text-sm font-semibold flex items-center justify-center min-w-[140px] ${is2faEnabled
                                    ? 'bg-red-100 text-red-800 border border-red-200 hover:bg-red-200'
                                : 'bg-[#0f9d58] text-[#FDFFFC] hover:bg-[#0d8a4d]'
                                }`}
                        >
                            {is2faEnabled ? (
                                <>
                                    <ShieldOff size={16} className="mr-2" />
                                    Deshabilitar
                                </>
                            ) : (
                                <>
                                    <ShieldCheck size={16} className="mr-2" />
                                    Habilitar 2FA
                                </>
                            )}
                        </button>
                        </div>
                        </div>
                    )}
                </Card>

                <Card>
                    <h2 className="text-lg font-semibold text-red-700 mb-1">Zona Peligrosa</h2>
                    <p className="text-sm mb-6">Estas acciones son permanentes y no se pueden deshacer.</p>

                    <div className="flex flex-col md:flex-row justify-between items-center p-4 dark:bg-gray-800 bg-red-50 border dark:border-red-700 border-red-200 rounded-lg">
                        <div>
                            <p className="font-medium ">Eliminar Cuenta</p>
                            <p className="text-sm mt-1">Una vez que elimines tu cuenta, no hay vuelta atrás.</p>
                        </div>
                        <Button
                            onClick={handleDeleteAccount}
                            color="red"
                            size="sm">
                            <Trash2 size={16} className="mr-2" />
                            Eliminar mi cuenta
                        </Button>
                    </div>
                </Card>
            </div>

            <TwoFactorAuthModal
                isOpen={isModalOpen}
                step={modalStep}
                actionType={modalAction}
                isSubmitting={isModalSubmitting}
                error={modalError}
                onClose={handleCloseModal}
                onPasswordSubmit={handlePasswordSubmit}
                onCodeSubmit={handleCodeSubmit}
            />
        </div>
    );
};
