import { AlertTriangleIcon } from 'lucide-react';

interface ErrorDisplayProps {
  title: string;
  message: string;
  buttonText: string;
  onRetry: () => void;
}

export const ErrorDisplay = ({ title, message, buttonText, onRetry }: ErrorDisplayProps) => {
  return (
    <div className="text-center py-8">
      <div className="mx-auto bg-red-100 rounded-full h-16 w-16 flex items-center justify-center mb-4">
        <AlertTriangleIcon className="h-8 w-8 text-red-600" />
      </div>
      <h2 className="text-2xl font-bold text-[#1B4965] mb-2">{title}</h2>
      <p className="text-gray-600 mb-8">{message}</p>
      <button
        onClick={onRetry}
        className="w-full bg-[#62B6CB] text-[#FDFFFC] py-2.5 rounded-md hover:opacity-90 transition-colors font-medium"
      >
        {buttonText}
      </button>
    </div>
  );
};