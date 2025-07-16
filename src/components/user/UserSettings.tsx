import React, { useState, useEffect } from 'react';
// Assuming you're using lucide-react for icons
import { ShieldCheck, ShieldOff, Loader2, Bell, Mail, Smartphone, Trash2, Check, Save, MailCheck } from 'lucide-react';
import { ActionType, TwoFactorAuthModal, TwoFactorStep } from './2FaModal';
import AuthService from '../../services/AuthService';

// --- Type Definitions for State and Props ---

// Defines the shape of the notification settings object
interface NotificationSettings {
    new_listings: boolean;
    price_drops: boolean;
    status_changes: boolean;
    open_houses: boolean;
    market_updates: boolean;
}

// Defines the shape of the notification channels object
interface NotificationChannels {
    email: boolean;
    push: boolean;
}

// Defines the props for our reusable checkbox component
interface SettingCheckboxProps {
    id: keyof NotificationSettings; // Ensure id is a valid key
    label: string;
    description: string;
    checked: boolean;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

// Defines the props for our reusable channel toggle component
interface ChannelToggleProps {
    icon: React.ReactNode;
    label: string;
    enabled: boolean;
    onClick: () => void;
}

// --- Reusable Typed Sub-components ---

const SettingCheckbox: React.FC<SettingCheckboxProps> = ({ id, label, description, checked, onChange }) => (
    <div className="flex items-start">
        <div className="flex items-center h-5">
            <input
                id={id}
                name={id}
                type="checkbox"
                checked={checked}
                onChange={onChange}
                className="focus:ring-[#47A9C2] h-4 w-4 text-[#62B6CB] border-gray-300 rounded"
            />
        </div>
        <div className="ml-3 text-sm">
            <label htmlFor={id} className="font-medium text-gray-700">{label}</label>
            <p className="text-gray-500">{description}</p>
        </div>
    </div>
);

const ChannelToggle: React.FC<ChannelToggleProps> = ({ icon, label, enabled, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={`flex-1 p-3 border rounded-lg flex items-center transition-all duration-200 ${enabled
            ? 'bg-[#BEE9E8] border-[#62B6CB] text-[#1B4965]'
            : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:border-gray-300'
            }`}
    >
        <div className={`mr-3 p-2 rounded-full ${enabled ? 'bg-white' : 'bg-gray-200'}`}>
            {React.cloneElement(icon as React.ReactElement<any>, { size: 20, className: enabled ? 'text-[#1B4965]' : 'text-gray-500' })}
        </div>
        <span className="font-semibold">{label}</span>
        {enabled && <Check size={20} className="ml-auto text-green-600" />}
    </button>
);

export function UserSettings() {
    // --- Main Page State ---
    // --- UPDATED: These states now reflect the user's data, fetched from an API. ---
    const [isEmailConfirmed, setIsEmailConfirmed] = useState<boolean>(false);
    const [is2faEnabled, setIs2faEnabled] = useState<boolean>(false);
    const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
        new_listings: true,
        price_drops: true,
        status_changes: false,
        open_houses: true,
        market_updates: false,
    });
    const [notificationChannels, setNotificationChannels] = useState<NotificationChannels>({
        email: true,
        push: true,
    });

    // --- NEW: Loading states for fetching data and specific actions ---
    const [isLoading, setIsLoading] = useState<boolean>(true); // For initial page load
    const [isResendingEmail, setIsResendingEmail] = useState<boolean>(false);
    const [isSavingNotifications, setIsSavingNotifications] = useState<boolean>(false);

    // --- NEW: State for the Modal Flow ---
    const [modalStep, setModalStep] = useState<TwoFactorStep>('password');
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [modalAction, setModalAction] = useState<ActionType>('enable');
    const [isModalSubmitting, setIsModalSubmitting] = useState<boolean>(false);
    const [modalError, setModalError] = useState<string | null>(null);
    const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

    // --- NEW: Fetch user settings on component mount ---
    useEffect(() => {
        const fetchUserSettings = async () => {
            setIsLoading(true);
            try {
                // This is where you would make your actual API call.
                // For demonstration, we'll use a mocked AuthService function.
                const userSettings = await AuthService.getUserSettings();

                // Update state with fetched data
                setIsEmailConfirmed(userSettings.emailConfirmed);
                setIs2faEnabled(userSettings.twoFactorEnabled);
                setNotificationSettings(userSettings.notificationSettings);
                setNotificationChannels(userSettings.notificationChannels);
            } catch (error) {
                console.error("Failed to fetch user settings:", error);
                // Handle error appropriately, e.g., show an error message
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserSettings();
    }, []); // Empty dependency array ensures this runs only once on mount


    // --- HANDLERS ---
    const handleInitiate2fa = () => {
        setModalAction(is2faEnabled ? 'disable' : 'enable');
        setModalStep('password');
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setModalError(null);
        setIsModalSubmitting(false);
    };

    const handlePasswordSubmit = async (password: string): Promise<void> => {
        setIsModalSubmitting(true);
        setModalError(null);

        try {
            // --- UPDATED: Check which action is being performed for the correct API call
            if (modalAction === 'enable') {
            await AuthService.requestLogin2faCode(password);
            console.log('Password verification successful. 2FA code requested.');
            setModalStep('code');
            } else { // 'disable' action
                // For disabling, you might just need a password and code together.
                // Assuming the flow is: enter password -> enter code to disable.
                setModalStep('code');
            }
        } catch (error: any) {
            console.error("Password verification failed:", error);
            setModalError(error.message || 'Ocurrió un error inesperado. Por favor, inténtalo de nuevo.');
        } finally {
            setIsModalSubmitting(false);
        }
    };

    const handleCodeSubmit = async (code: string): Promise<void> => {
        setIsModalSubmitting(true);
        setModalError(null);
        try {
            if (modalAction === 'enable') {
                const response = await AuthService.enable2fa(code);
                setRecoveryCode(response.recoveryCode);
                setModalStep('success');
                setIs2faEnabled(true);
            } else {
                console.log('2FA disabled successfully.');
                setIs2faEnabled(false);
                handleCloseModal();
            }
        } catch (error: any) {
            console.error(`Error during 2FA ${modalAction}:`, error);
            setModalError(error.response?.data?.message || 'El código de verificación es inválido o ha expirado.');
        } finally {
            setIsModalSubmitting(false);
        }
    };

    // --- NEW: Handler for resending the confirmation email ---
    const handleResendConfirmationEmail = async () => {
        setIsResendingEmail(true);
        try {
            await AuthService.resendConfirmationEmail();
            // Optionally, show a success toast: "Confirmation email sent!"
            alert("Se ha reenviado el correo de confirmación a tu dirección de email.");
        } catch (error) {
            console.error("Failed to resend confirmation email:", error);
            // Optionally, show an error toast
            alert("No se pudo reenviar el correo. Por favor, inténtalo de nuevo más tarde.");
        } finally {
            setIsResendingEmail(false);
        }
    };

    const handleSaveNotifications = (e: React.FormEvent<HTMLFormElement>): void => {
        e.preventDefault();
        setIsSavingNotifications(true);
        console.log("Saving notification preferences:", { notificationSettings, notificationChannels });
        setTimeout(() => {
            setIsSavingNotifications(false);
        }, 2000);
    };

    const handleChannelChange = (channel: keyof NotificationChannels): void => {
        setNotificationChannels(prev => ({ ...prev, [channel]: !prev[channel] }));
    };

    const handleNotificationChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
        const { name, checked } = event.target;
        setNotificationSettings(prev => ({
            ...prev,
            [name as keyof NotificationSettings]: checked,
        }));
    };
    
    const handleDeleteAccount = (): void => {
        if (window.confirm("¿Estás seguro de que quieres eliminar tu cuenta permanentemente? Esta acción no se puede deshacer.")) {
            console.log("Initiating account deletion...");
        }
    };

    // --- NEW: Render a loading state for the whole page ---
    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="animate-spin h-8 w-8 text-[#62B6CB]" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6">
            <h1 className="text-2xl font-bold text-[#1B4965] mb-6">Configuración</h1>

            <div className="space-y-8">
                {/* --- Security Settings Card --- */}
                <div className="bg-[#FDFFFC] rounded-lg shadow-sm border border-gray-100 p-6">
                    <h2 className="text-lg font-semibold text-[#1B4965] mb-1">Seguridad</h2>
                    <p className="text-sm text-gray-500 mb-6">Gestiona la seguridad de tu cuenta.</p>

                    {/* --- UPDATED: Conditional rendering based on email confirmation status --- */}
                    {!isEmailConfirmed ? (
                        // STATE 1: Email is NOT confirmed
                        <div className="flex flex-col md:flex-row justify-between items-center p-4 border rounded-lg bg-amber-50 border-amber-200">
                        <div>
                            <p className="font-medium text-gray-800">Verificación de email</p>
                            <p className="text-sm text-gray-500 mt-1">Verifica tu correo para poder acceder a todas las funcionalidades de la aplicación.</p>
                        </div>
                        <button
                                onClick={handleResendConfirmationEmail}
                                disabled={isResendingEmail}
                                className="mt-4 md:mt-0 px-4 py-2 rounded-md transition-colors text-sm font-semibold flex items-center justify-center min-w-[180px] bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        </button>
                        </div>
                    ) : (
                        // STATE 2 & 3: Email IS confirmed, show 2FA options
                        <div className="flex flex-col md:flex-row justify-between items-center p-4 border rounded-lg">
                        <div>
                            <p className="font-medium text-gray-800">Autenticación de dos factores (2FA)</p>
                            <p className="text-sm text-gray-500 mt-1">Añade una capa extra de seguridad a tu cuenta al iniciar sesión.</p>
                        </div>
                        <button
                                onClick={handleInitiate2fa}
                            className={`mt-4 md:mt-0 px-4 py-2 rounded-md transition-colors text-sm font-semibold flex items-center justify-center min-w-[140px] ${is2faEnabled
                                    ? 'bg-red-100 text-red-800 border border-red-200 hover:bg-red-200'
                                : 'bg-[#62B6CB] text-[#FDFFFC] hover:bg-[#47A9C2]'
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
                    )}
                </div>

                {/* --- Notification Settings Card --- */}
                <div className="bg-[#FDFFFC] rounded-lg shadow-sm border border-gray-100 p-6">
                    <h2 className="text-lg font-semibold text-[#1B4965] mb-1">Notificaciones</h2>
                    <p className="text-sm text-gray-500 mb-6">Elige qué actualizaciones recibes y cómo las recibes.</p>

                    <form onSubmit={handleSaveNotifications}>
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-md font-medium text-gray-800 mb-3">Recibir alertas por:</h3>
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <ChannelToggle
                                        icon={<Mail />}
                                        label="Correo Electrónico"
                                        enabled={notificationChannels.email}
                                        onClick={() => handleChannelChange('email')}
                                    />
                                    <ChannelToggle
                                        icon={<Smartphone />}
                                        label="Notificación Push"
                                        enabled={notificationChannels.push}
                                        onClick={() => handleChannelChange('push')}
                                    />
                                </div>
                            </div>

                            <hr className="border-gray-200" />

                            <div>
                                <h3 className="text-md font-medium text-gray-800 mb-4">Notificarme sobre:</h3>
                                <div className="space-y-4">
                                    <SettingCheckbox id="new_listings" label="Nuevos Anuncios" description="Propiedades que coinciden con tus búsquedas guardadas." checked={notificationSettings.new_listings} onChange={handleNotificationChange} />
                                    <SettingCheckbox id="price_drops" label="Bajadas de Precio" description="Alertas cuando una propiedad que te gusta baja de precio." checked={notificationSettings.price_drops} onChange={handleNotificationChange} />
                                    <SettingCheckbox id="status_changes" label="Cambios de Estado" description="Cuando una propiedad guardada pasa a 'Pendiente' o 'Vendida'." checked={notificationSettings.status_changes} onChange={handleNotificationChange} />
                                    <SettingCheckbox id="open_houses" label="Open Houses" description="Anuncios de puertas abiertas para propiedades guardadas." checked={notificationSettings.open_houses} onChange={handleNotificationChange} />
                                    <SettingCheckbox id="market_updates" label="Noticias del Mercado" description="Un resumen semanal o mensual con tendencias de tu zona." checked={notificationSettings.market_updates} onChange={handleNotificationChange} />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-6 mt-6 border-t border-gray-200">
                            <button
                                type="submit"
                                disabled={isSavingNotifications}
                                className="bg-[#5CA4B8] text-[#FDFFFC] px-4 py-2 rounded-md hover:bg-[#62B6CB] transition-colors text-sm flex items-center disabled:opacity-50"
                            >
                                {isSavingNotifications ? (
                                    <>
                                        <Loader2 className="animate-spin h-4 w-4 mr-2" />
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} className="mr-2" /> Guardar Cambios
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                {/* --- Danger Zone Card --- */}
                <div className="bg-[#FDFFFC] rounded-lg shadow-sm border border-red-300 p-6">
                    <h2 className="text-lg font-semibold text-red-700 mb-1">Zona Peligrosa</h2>
                    <p className="text-sm text-gray-500 mb-6">Estas acciones son permanentes y no se pueden deshacer.</p>

                    <div className="flex flex-col md:flex-row justify-between items-center p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div>
                            <p className="font-medium text-red-800">Eliminar Cuenta</p>
                            <p className="text-sm text-red-600 mt-1">Una vez que elimines tu cuenta, no hay vuelta atrás. Por favor, ten la certeza.</p>
                        </div>
                        <button
                            onClick={handleDeleteAccount}
                            className="mt-4 md:mt-0 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors text-sm font-semibold flex items-center"
                        >
                            <Trash2 size={16} className="mr-2" />
                            Eliminar mi cuenta
                        </button>
                    </div>
                </div>
            </div>

            <TwoFactorAuthModal
                isOpen={isModalOpen}
                step={modalStep}
                actionType={modalAction}
                isSubmitting={isModalSubmitting}
                error={modalError}
                recoveryCode={recoveryCode}
                onClose={handleCloseModal}
                onPasswordSubmit={handlePasswordSubmit}
                onCodeSubmit={handleCodeSubmit}
            />
        </div>
    );
};