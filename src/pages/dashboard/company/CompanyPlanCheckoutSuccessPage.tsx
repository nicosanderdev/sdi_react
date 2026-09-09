import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Button, Spinner } from 'flowbite-react';
import { CheckCircle } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { fetchUserProfile } from '../../../store/slices/userSlice';

export function CompanyPlanCheckoutSuccessPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const attemptId = searchParams.get('attemptId');

  useEffect(() => {
    dispatch(fetchUserProfile() as any);
    const timer = setTimeout(() => {
      navigate('/dashboard/company');
    }, 2500);
    return () => clearTimeout(timer);
  }, [dispatch, navigate]);

  return (
    <div className="max-w-lg mx-auto p-6" data-testid="company-plan-checkout-success">
      <Card>
        <div className="text-center space-y-4 py-6">
          <CheckCircle className="w-14 h-14 text-green-600 mx-auto" />
          <h1 className="text-2xl font-bold">Pago recibido</h1>
          <p className="text-gray-600">
            Si Mercado Pago confirmó el pago, tu empresa y el plan quedarán activos en unos instantes.
          </p>
          {attemptId && <p className="text-xs text-gray-400">Ref: {attemptId}</p>}
          <Spinner size="sm" />
          <Button onClick={() => navigate('/dashboard/company')}>Ir a la empresa</Button>
        </div>
      </Card>
    </div>
  );
}
