import React, { useState, FormEvent, useEffect } from 'react';
import { XIcon, EyeIcon, EyeOffIcon, ShieldCheckIcon, KeyRoundIcon, LockKeyholeIcon } from 'lucide-react';
import profileService from '../../services/ProfileService';
import authService, { TwoFaPayload, ValidateRecoveryPayload, ResetPasswordPayload } from '../../services/AuthService';
import { Button, Card, Label, TextInput } from 'flowbite-react';

// Steps of the modal flow
type ModalStep = 'INITIAL_LOADING' | 'REQUIRE_2FA' | 'REQUIRE_RECOVERY' | 'SET_NEW_PASSWORD' | 'FINAL_ERROR';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ChangePasswordModal({ isOpen, onClose, onSuccess }: ChangePasswordModalProps) {
  const [step, setStep] = useState<ModalStep>('INITIAL_LOADING');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordMismatchError, setPasswordMismatchError] = useState<string | null>(null);
  
  // State for form inputs
  const [otp, setOtp] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  
  // This token is received after successful 2FA/recovery validation
  // and is required for the final password change step.
  const [changeToken, setChangeToken] = useState<string | null>(null);
  
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handlePasswordChange = (value: string, isNewPassword: boolean) => {
    if (isNewPassword) {
      setNewPassword(value);
    } else {
      setConfirmNewPassword(value);
    }
    
    if (passwordMismatchError) {
      setPasswordMismatchError(null);
    }
    
    if (isNewPassword && confirmNewPassword) {
      if (value !== confirmNewPassword) {
        setPasswordMismatchError('Las contraseñas no coinciden.');
      } else {
        setPasswordMismatchError(null);
      }
    } else if (!isNewPassword && newPassword) {
      if (newPassword !== value) {
        setPasswordMismatchError('Las contraseñas no coinciden.');
      } else {
        setPasswordMismatchError(null);
      }
    }
  };

  // Effect to initiate the flow when the modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('INITIAL_LOADING');
      setError(null);
      setPasswordMismatchError(null);
      setOtp('');
      setRecoveryCode('');
      setNewPassword('');
      setConfirmNewPassword('');
      setChangeToken(null);
      setIsSubmitting(false);

      const requestChange = async () => {
        try {
          const response = await profileService.requestPasswordChange();
          if (response.is2FaRequired) {
            setStep('REQUIRE_2FA');
          } else {
            setChangeToken("token-for-no-2fa-flow");
            setStep('SET_NEW_PASSWORD');
          }
        } catch (err: any) {
          setError(err.message || "Could not start the process. Please try again later.");
          setStep('FINAL_ERROR');
        }
      };
      requestChange();
    }
  }, [isOpen]);

  const handleValidateOtp = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const payload: TwoFaPayload = { twoFactorCode: otp };
      const response = await authService.validate2FaCodePasswordChange(payload);
      setChangeToken(response.token!);
      setStep('SET_NEW_PASSWORD');
    } catch (err: any) {
      setError(err.message || "Failed to validate code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleValidateRecovery = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const payload: ValidateRecoveryPayload = { recoveryCode };
      await authService.validateRecoveryPasswordChange (payload);
      setStep('SET_NEW_PASSWORD');
    } catch (err: any) {
      setError(err.message || "Failed to validate recovery code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmPassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordMismatchError(null);
    setError(null);
    
    if (newPassword !== confirmNewPassword) {
      setPasswordMismatchError('Las contraseñas no coinciden.');
      return;
    }
    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (!changeToken) {
        setError("Session is invalid. Please start over.");
        setStep('FINAL_ERROR');
        return;
    }

    setIsSubmitting(true);
    setError(null);
    
    try {
      const payload: ResetPasswordPayload = { newPassword: newPassword, token: changeToken, email: '', resetEmail: false };
      await authService.resetPassword(payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to change password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {

    case 'INITIAL_LOADING':
        return (
          <div className="text-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p>Verificando requisitos de seguridad...</p>
          </div>
        );

      case 'REQUIRE_2FA':
        return (
          <form onSubmit={handleValidateOtp} className="space-y-4">
            <p className="text-sm">Por favor, ingresa el código de verificación que te enviamos a tu correo electrónico.</p>
            <div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">Código de verificación</label>
                <input id="otp" type="text" value={otp} onChange={(e) => setOtp(e.target.value)} required maxLength={6} className="pl-3 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
            </div>
            <Button 
                type="submit" 
                disabled={isSubmitting} 
                className='w-full mx-auto'>
              {isSubmitting ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <><ShieldCheckIcon size={18} className="mr-2"/> Verificar código</>}
            </Button>
            <Button 
                type="button" 
                onClick={() => setStep('REQUIRE_RECOVERY')} 
                color='alternative'
                className='w-full mx-auto'>
              ¿Perdiste el accesso a tu correo? Usá el código de recuperación
            </Button>
          </form>
        );

      case 'REQUIRE_RECOVERY':
        return (
            <form onSubmit={handleValidateRecovery} className="space-y-4">
              <p className="text-sm text-gray-600">Ingresá tu código de recuperación a continuación.</p>
              <div>
                  <label htmlFor="recoveryCode" className="block text-sm font-medium text-gray-700 mb-1">Código de recuperación</label>
                  <input id="recoveryCode" type="text" value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} required className="pl-3 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-[#62B6CB] text-white py-2 rounded-lg hover:bg-[#47A9C2] disabled:opacity-50 flex items-center justify-center">
                {isSubmitting ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <><KeyRoundIcon size={18} className="mr-2"/> Usar código</>}
              </button>
              <button type="button" onClick={() => setStep('REQUIRE_2FA')} className="w-full text-center text-sm text-[#1B4965] hover:underline">
                Volver a verificación por correo
              </button>
            </form>
        );

      case 'SET_NEW_PASSWORD':
        return (
            <>
                <form onSubmit={handleConfirmPassword} className="space-y-4">
                    {/* <p className="text-sm text-green-700 bg-green-100 p-2 rounded-md">Verificación exitosa. Ingresá tu nueva contraseña</p> */}
                    <div>
                        <Label htmlFor="newPassword1" className='text-md'>Nueva contraseña</Label>
                        <div className="relative my-1"><input id="newPassword1" type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => { setNewPassword(e.target.value); handlePasswordChange(e.target.value, true) }} required className="pl-3 pr-10 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" /><button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm text-gray-500">{showNewPassword ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}</button></div>
                        <p className="text-xs text-gray-500 mt-1">Minimum 8 characters.</p>
                    </div>
                    <div className='mb-8'>
                        <Label htmlFor="newPassword2" className='text-md'>Confirmar nueva contraseña</Label>
                        <div className="relative my-1"><input type={showConfirmPassword ? "text" : "password"} value={confirmNewPassword} onChange={(e) => { setConfirmNewPassword(e.target.value); handlePasswordChange(e.target.value, false) }} required className="pl-3 pr-10 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" /><button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm text-gray-500">{showConfirmPassword ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}</button></div>
                        {passwordMismatchError && <p className="text-xs text-red-500 mt-1">{passwordMismatchError}</p>}
                    </div>
                    <Button 
                        disabled={isSubmitting || newPassword === '' || confirmNewPassword === '' || newPassword.length < 8 || passwordMismatchError !== null}
                        className='mx-auto w-full'>
                        {isSubmitting ? 
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> 
                        : <>
                            <LockKeyholeIcon size={18} className="mr-2"/>
                            Guardar nueva contraseña
                        </>}
                    </Button>
                </form>
            </>
        );
      
      case 'FINAL_ERROR':
        return (
            <div className="text-center p-4">
                <p className="text-red-600 mb-4">{error}</p>
                <button onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg">Close</button>
            </div>
        )
    }
  };


  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-gray-400/20 flex items-center justify-center p-4 z-50">
      <Card className='w-full max-w-lg p-2'>
        <div className="flex justify-between items-center mb-4">
          <h3 className='text-xl font-semibold'>Cambiar Contraseña</h3>
          <button onClick={onClose} 
            className='text-gray-500 hover:text-gray-700'>
            <XIcon size={24} />
          </button>
        </div>
        
        {renderStepContent()}

        {error && step !== 'FINAL_ERROR' && (
          <p className="text-sm text-red-500 mt-4 text-center">{error}</p>
        )}
      </Card>
    </div>
  );
}