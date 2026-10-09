import { useState } from 'react';
import { Card } from 'flowbite-react';
import { PropertyCreationWizard } from '../../components/dashboard/properties/PropertyCreationWizard';
import { SuccessDisplay } from '../../components/ui/SuccessDisplay';
import { useQuery } from '@tanstack/react-query';
import subscriptionService from '../../services/SubscriptionService';
import type { PropertyType } from '../../models/properties';
import {
  CREATE_BLOCKED_NO_TYPES_MESSAGE,
  resolveCreatablePropertyTypesFromSubscription,
} from '../../models/properties/creatablePropertyTypes';

interface AddPropertyFormProps {
  onClose: () => void;
}

export function AddPropertyForm({ onClose }: AddPropertyFormProps) {
  const [view, setView] = useState<'form' | 'success'>('form');

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['current-subscription'],
    queryFn: () => subscriptionService.getCurrentSubscription(),
  });

  const availablePropertyTypes: PropertyType[] =
    resolveCreatablePropertyTypesFromSubscription(subscription);

  if (isLoading) {
    return (
      <Card className="min-h-full">
        <p className="text-sm text-gray-500">Cargando…</p>
      </Card>
    );
  }

  if (availablePropertyTypes.length === 0) {
    return (
      <Card className="min-h-full">
        <p className="text-sm text-gray-700 dark:text-gray-200">{CREATE_BLOCKED_NO_TYPES_MESSAGE}</p>
        <button
          type="button"
          className="mt-4 text-sm text-primary-700 underline"
          onClick={onClose}
        >
          Volver
        </button>
      </Card>
    );
  }

  return (
    <Card className="min-h-full">
      {view === 'form' && (
        <div id="onboarding-plan-limit">
          <PropertyCreationWizard
            initialContext={{
              mode: 'user',
              isAdmin: false,
              availablePropertyTypes,
            }}
            onComplete={async () => {
              setView('success');
            }}
            onClose={onClose}
          />
        </div>
      )}
      {view === 'success' && (
        <SuccessDisplay
          title="¡Registro de propiedad exitoso!"
          message="La propiedad ha sido registrada correctamente."
          redirectUrl="/dashboard/properties"
        />
      )}
    </Card>
  );
}
