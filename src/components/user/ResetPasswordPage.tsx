import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { LockKeyholeIcon, CheckCircleIcon, XCircleIcon } from 'lucide-react';
import AuthService, { ResetPasswordPayload } from '../../services/AuthService';
import { supabase } from '../../config/supabase';

type TokenStatus = 'VALIDATING' | 'VALID' | 'INVALID';

export function ResetPasswordPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [tokenStatus, setTokenStatus] = useState<TokenStatus>('VALIDATING');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);

    const token = searchParams.get('token');

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
                    <h2 className="mt-4 text-xl font-semibold text-[#1B4965]">{isSuccess ? 'Contraseña Restablecida' : 'Enlace Inválido'}</h2>
                    <p className="mt-2 text-gray-600">{isSuccess ? 'Tu contraseña ha sido cambiada con éxito.' : error}</p>
                    <button onClick={() => navigate(isSuccess ? '/login' : '/forgot-password')} className="mt-6 w-full bg-[#62B6CB] text-white py-2 rounded-lg">
                        {isSuccess ? 'Ir a Iniciar Sesión' : 'Solicitar Nuevo Enlace'}
                    </button>
                </div>
            );
        }

        // if (tokenStatus === 'VALID')
        return (
            <>
                <div className="text-center mb-8"><h1 className="text-2xl font-bold text-[#1B4965] mb-2">Crear Nueva Contraseña</h1><p className="text-gray-600">Por favor, ingresa tu nueva contraseña.</p></div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <div><label className="block text-sm font-medium text-[#101828] mb-1">Nueva Contraseña</label><div className="relative"><input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg" disabled={isSubmitting} /><LockKeyholeIcon className="absolute left-3 top-2.5 text-gray-400" size={18} /></div><p className="text-xs text-gray-500 mt-1">Mínimo 8 caracteres.</p></div>
                    <div><label className="block text-sm font-medium text-[#101828] mb-1">Confirmar Nueva Contraseña</label><div className="relative"><input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg" disabled={isSubmitting} /><LockKeyholeIcon className="absolute left-3 top-2.5 text-gray-400" size={18} /></div></div>
                    <button type="submit" disabled={isSubmitting} className="w-full bg-[#5CA4B8] text-[#FDFFFC] py-2 rounded-md hover:opacity-90 transition-colors flex items-center justify-center">{isSubmitting ? 'Guardando...' : 'Guardar Contraseña'}</button>
                </form>
            </>
        )
    }

    return (
        <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-[#BEE9E8] to-[#FDFFFC] py-16">
            <div className="max-w-md mx-auto px-4">
                <div className="bg-[#FDFFFC] p-8 rounded-lg shadow-sm border border-gray-100">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
}