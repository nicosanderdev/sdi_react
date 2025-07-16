import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import AuthService  from '../../services/AuthService';

export function EmailConfirmationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: AuthService.confirmEmail,
    onSuccess: () => {
      // On success, redirect to the dashboard after a short delay
      setTimeout(() => navigate('/dashboard'), 3000);
    },
    onError: (err) => {
      // Log the error for debugging
      console.error('Email confirmation failed:', err);
    },
  });

  useEffect(() => {
    if (token) {
      mutate(token);
    } else {
      // If no token is found, redirect to the login page
      navigate('/login');
    }
  }, [token, mutate, navigate]);

  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="p-10 bg-white rounded-lg shadow-md text-center">
          <h1 className="text-2xl font-bold text-gray-800">Confirming your email...</h1>
          <p className="text-gray-600 mt-2">Please wait a moment.</p>
          {/* You can add a spinner here */}
        </div>
      </div>
    );
  }

  if (isError) {
    const errorMessage =
      (error as any)?.response?.data?.message ||
      'The confirmation link is invalid or has expired.';
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="p-10 bg-white rounded-lg shadow-md text-center">
          <h1 className="text-2xl font-bold text-red-600">Confirmation Failed</h1>
          <p className="text-gray-600 mt-2">{errorMessage}</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-6 px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="p-10 bg-white rounded-lg shadow-md text-center">
          <h1 className="text-2xl font-bold text-green-600">Email Confirmed!</h1>
          <p className="text-gray-600 mt-2">
            Thank you! You will be redirected to the dashboard shortly.
          </p>
        </div>
      </div>
    );
  }

  return null;
};

export default EmailConfirmationPage;

