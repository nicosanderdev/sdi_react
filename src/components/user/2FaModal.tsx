import { KeyRound, Loader2, ShieldCheck, X } from "lucide-react";
import { useState, useEffect } from "react";
import { TwoFactorInput } from '../public/TwoFactorInput';

export type TwoFactorStep = 'password' | 'code' | 'success';
export type ActionType = 'enable' | 'disable';

interface TwoFactorAuthModalProps {
  step: TwoFactorStep;
  actionType: ActionType;
  isOpen: boolean;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onPasswordSubmit: (password: string) => void;
  onCodeSubmit: (code: string) => void;
}

export function TwoFactorAuthModal({
  step,
  actionType,
  isOpen,
  isSubmitting,
  error,
  onClose,
  onPasswordSubmit,
  onCodeSubmit }: TwoFactorAuthModalProps) {

  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    if (isOpen) {
        setPassword('');
        setCode('');
    }
  }, [isOpen, step]);


  if (!isOpen) {
    return null;
  }

  const handlePasswordFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onPasswordSubmit(password);
  };

  const handleCodeFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onCodeSubmit(code);
  };

  let title = '';
  let description = '';
  if (step === 'password') {
    title = 'Confirmar Acción';
    description = `Por tu seguridad, ingresá tu contraseña para ${actionType === 'enable' ? 'habilitar' : 'deshabilitar'} la autenticación de dos factores.`
  } else if (step === 'code') {
    title = `Verificar Código de ${actionType === 'enable' ? 'Activación' : 'Desactivación'}`;
    description = `Enviamos un código de 6 dígitos por WhatsApp al teléfono verificado de tu cuenta. Ingresalo a continuación.`;
  } else {
    title = actionType === 'enable' ? '2FA habilitado' : '2FA deshabilitado';
    description = actionType === 'enable'
      ? 'La autenticación de dos factores quedó activa. En el próximo inicio de sesión te pediremos un código por WhatsApp.'
      : 'La autenticación de dos factores quedó desactivada para tu cuenta.';
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-[#1B4965]">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <p className="text-gray-600 mb-6 text-sm">{description}</p>

        {step === 'password' && (
          <form onSubmit={handlePasswordFormSubmit} className="space-y-4">
            <div>
              <label htmlFor="password-confirm" className="block text-sm font-medium text-gray-700 mb-1">Tu Contraseña</label>
              <div className="relative">
                <KeyRound size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="password-confirm"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]"
                  autoFocus
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex justify-end space-x-3 pt-2">
              <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm">Cancelar</button>
              <button type="submit" disabled={isSubmitting || !password} className="bg-[#62B6CB] text-[#FDFFFC] px-4 py-2 rounded-md hover:bg-[#47A9C2] transition-colors text-sm disabled:opacity-50 flex items-center">
                {isSubmitting && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                Confirmar
              </button>
            </div>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={handleCodeFormSubmit} className="space-y-6">
            <div>
              <TwoFactorInput
                length={6}
                value={code}
                onChange={setCode}
                onComplete={(completedCode) => {
                  if (!isSubmitting) {
                    onCodeSubmit(completedCode);
                  }
                }}
                disabled={isSubmitting}
              />
            </div>
            {error && <p className="text-sm text-red-500 text-center -mt-2">{error}</p>}
            <div className="flex justify-end space-x-3 pt-2">
              <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm">Cancelar</button>
              <button type="submit" disabled={isSubmitting || code.length < 6} className="bg-[#62B6CB] text-[#FDFFFC] px-4 py-2 rounded-md hover:bg-[#47A9C2] transition-colors text-sm disabled:opacity-50 flex items-center">
                {isSubmitting && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                Verificar y {actionType === 'enable' ? 'Habilitar' : 'Deshabilitar'}
              </button>
            </div>
          </form>
        )}

        {step === 'success' && (
            <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="rounded-full bg-green-100 p-3">
                    <ShieldCheck className="h-8 w-8 text-green-700" />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                    <button type="button" onClick={onClose} className="bg-[#62B6CB] text-[#FDFFFC] px-4 py-2 rounded-md hover:bg-[#47A9C2] transition-colors text-sm">
                        Entendido
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
