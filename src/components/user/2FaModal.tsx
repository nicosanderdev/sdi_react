import { Clipboard, ClipboardCheck, KeyRound, Loader2, X } from "lucide-react";
import { useState, useEffect } from "react";
// --- START: Key Change ---
// Import the stylish six-box input component
import { TwoFactorInput } from '../../pages/public/TwoFactorInput';
// Note: You might need to adjust the import path '../public/form/TwoFactorInput'
// based on your actual file structure.
// --- END: Key Change ---

export type TwoFactorStep = 'password' | 'code' | 'success';
export type ActionType = 'enable' | 'disable';

interface TwoFactorAuthModalProps {
  step: TwoFactorStep;
  actionType: ActionType;
  isOpen: boolean;
  isSubmitting: boolean;
  error: string | null;
  recoveryCode: string | null;
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
  recoveryCode,
  onClose,
  onPasswordSubmit,
  onCodeSubmit }: TwoFactorAuthModalProps) {

  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  
  // Effect to clear local state when the modal re-opens or changes step
  useEffect(() => {
    if (isOpen) {
        setPassword('');
        setCode('');
        setIsCopied(false);
    }
  }, [isOpen, step]);


  if (!isOpen) {
    return null;
  }

  const handleCopy = () => {
    if (recoveryCode) {
      navigator.clipboard.writeText(recoveryCode);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

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
    description = `Por tu seguridad, por favor ingresa tu contraseña para ${actionType === 'enable' ? 'habilitar' : 'deshabilitar'} la autenticación de dos factores.`
  } else if (step === 'code') {
    title = `Verificar Código de ${actionType === 'enable' ? 'Activación' : 'Desactivación'}`;
    description = `Hemos enviado un código de verificación a tu correo electrónico. Ingrésalo a continuación.`;
  } else {
    title = 'Código de Recuperación';
    description = 'Guarda este código de recuperación en un lugar seguro. Lo necesitarás para acceder a tu cuenta si pierdes el acceso a tu autenticador.';
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

        {/* --- Step 1: Password Prompt --- */}
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

        {/* --- Step 2: 2FA Code Prompt --- */}
        {step === 'code' && (
          <form onSubmit={handleCodeFormSubmit} className="space-y-6">
            <div>
              <TwoFactorInput
                length={6}
                value={code}
                onChange={setCode}
                onComplete={(completedCode) => {
                  // Automatically submit when the code is complete for better UX
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

        {/* --- Step 3: Success Screen --- */}
        {step === 'success' && (
            <div className="space-y-4">
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                    <p className="font-mono text-2xl text-center tracking-widest text-blue-800 bg-blue-100 p-3 rounded">{recoveryCode}</p>
                </div>
                <button
                    onClick={handleCopy}
                    className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                    {isCopied ? (
                        <>
                            <ClipboardCheck size={18} className="mr-2" />
                            ¡Copiado!
                        </>
                    ) : (
                        <>
                            <Clipboard size={18} className="mr-2" />
                            Copiar Código
                        </>
                    )}
                </button>
                <div className="flex justify-end pt-2">
                    <button type="button" onClick={onClose} className="bg-[#62B6CB] text-[#FDFFFC] px-4 py-2 rounded-md hover:bg-[#47A9C2] transition-colors text-sm">
                        Entendido, he guardado mi código
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};