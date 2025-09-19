import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2Icon } from 'lucide-react';

interface SuccessDisplayProps {
  title: string;
  message: string;
  redirectUrl: string;
  delay?: number;
}

export const SuccessDisplay = ({ title, message, redirectUrl, delay = 2000 }: SuccessDisplayProps) => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate(redirectUrl);
    }, delay);

    return () => clearTimeout(timer);
  }, [navigate, redirectUrl, delay]);

  return (
    <div className="text-center py-8">
      <div className="mx-auto bg-green-100 rounded-full h-16 w-16 flex items-center justify-center mb-4">
        <CheckCircle2Icon className="h-8 w-8 text-green-600" />
      </div>
      <h2 className="text-2xl font-bold mb-2">{title}</h2>
      <p className="">{message}</p>
    </div>
  );
};