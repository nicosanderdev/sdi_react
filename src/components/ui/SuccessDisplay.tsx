import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2Icon } from 'lucide-react';

interface SuccessDisplayProps {
  title: string;
  message: string;
  redirectUrl?: string;
  delay?: number;
  action?: ReactNode;
}

export const SuccessDisplay = ({ title, message, redirectUrl, delay = 2000, action }: SuccessDisplayProps) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!redirectUrl) return;

    const timer = setTimeout(() => {
      navigate(redirectUrl);
    }, delay);

    return () => clearTimeout(timer);
  }, [navigate, redirectUrl, delay]);

  return (
    <div className="text-center py-8">
      <div className="mx-auto bg-green-100 dark:bg-green-900/20 rounded-full h-16 w-16 flex items-center justify-center mb-4">
        <CheckCircle2Icon className="h-8 w-8 text-green-600 dark:text-green-400" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{title}</h2>
      <p className={`text-gray-600 dark:text-gray-300${action ? ' mb-8' : ''}`}>{message}</p>
      {action}
    </div>
  );
};