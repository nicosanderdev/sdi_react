import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyholeIcon, CheckCircleIcon, XCircleIcon } from 'lucide-react';
import { supabase } from '../../config/supabase';
import { PublicLayout } from '../layout/PublicLayout';

type TokenStatus = 'VALIDATING' | 'VALID' | 'INVALID';

export function ResetPasswordPage() {
    const navigate = useNavigate();

    const [tokenStatus, setTokenStatus] = useState<TokenStatus>('VALIDATING');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);

    useEffect(() => {
        // With Supabase, the session is automatically restored from the URL fragment
        // when the user clicks the reset password link
        const checkSession = async () => {
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error) {
                console.error('Session error:', error);
                setTokenStatus('INVALID');
                setError('El enlace de restablecimiento es inválido o ha expirado.');
                return;
            }

            if (session) {
                setTokenStatus('VALID');
            } else {
                setTokenStatus('INVALID');
                setError('El enlace de restablecimiento es inválido o ha expirado.');
            }
        };

        checkSession();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) {
                throw error;
            }

            setIsSuccess(true);
        } catch (err: any) {
            setError(err.message || "No se pudo restablecer la contraseña.");
        } finally {
            setIsSubmitting(false);
        }
    }

    const renderContent = () => {
        if (tokenStatus === 'VALIDATING') {
            return <div className="text-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div><p className="mt-4 text-gray-600">Validando enlace...</p></div>;
        }

        if (tokenStatus === 'INVALID' || isSuccess) {
            return (
                <div className="text-center">
                    {isSuccess ? <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500" /> : <XCircleIcon className="mx-auto h-12 w-12 text-red-500" />}
                    <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">{isSuccess ? 'Contraseña Restablecida' : 'Enlace Inválido'}</h2>
                    <p className="mt-2 text-gray-600">{isSuccess ? 'Tu contraseña ha sido cambiada con éxito.' : error}</p>
                    <button onClick={() => navigate(isSuccess ? '/login' : '/forgot-password')} className="mt-6 w-full bg-green-600 text-white py-2 rounded-full">
                        {isSuccess ? 'Ir a Iniciar Sesión' : 'Solicitar Nuevo Enlace'}
                    </button>
                </div>
            );
        }

        // if (tokenStatus === 'VALID')
        return (
            <>
                <div className="text-center mb-8"><h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Crear Nueva Contraseña</h1><p className="text-gray-600 dark:text-gray-300">Por favor, ingresa tu nueva contraseña.</p></div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <div><label className="block text-sm font-medium text-[#101828] mb-1">Nueva Contraseña</label><div className="relative"><input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg" disabled={isSubmitting} /><LockKeyholeIcon className="absolute left-3 top-2.5 text-gray-400" size={18} /></div><p className="text-xs text-gray-500 mt-1">Mínimo 8 caracteres.</p></div>
                    <div><label className="block text-sm font-medium text-[#101828] mb-1">Confirmar Nueva Contraseña</label><div className="relative"><input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg" disabled={isSubmitting} /><LockKeyholeIcon className="absolute left-3 top-2.5 text-gray-400" size={18} /></div></div>
                    <button type="submit" disabled={isSubmitting} className="w-full bg-green-600 text-white py-2 rounded-full hover:bg-green-700 transition-colors flex items-center justify-center">{isSubmitting ? 'Guardando...' : 'Guardar Contraseña'}</button>
                </form>
            </>
        )
    }

    return (
        <PublicLayout>
            <div className="min-h-[calc(100vh-64px)] bg-white dark:bg-gray-900 py-16">
                <div className="max-w-md mx-auto px-4">
                    <div className="bg-white dark:bg-gray-950 p-8 rounded-3xl shadow-md border border-gray-100 dark:border-gray-700">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </PublicLayout>
    );
}