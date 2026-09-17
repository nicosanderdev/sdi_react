import { useState } from 'react';
import { Card } from 'flowbite-react';
import { PropertyCreationWizard } from '../../components/dashboard/properties/PropertyCreationWizard';
import { SuccessDisplay } from '../../components/ui/SuccessDisplay';
import { useQuery } from '@tanstack/react-query';
import subscriptionService from '../../services/SubscriptionService';
import type { PropertyType } from '../../models/properties';
interface AddPropertyFormProps {
  onClose: () => void;
}

export function AddPropertyForm({ onClose }: AddPropertyFormProps) {
  const [view, setView] = useState<'form' | 'success'>('form');

  const { data: subscription } = useQuery({
    queryKey: ['current-subscription'],
    queryFn: () => subscriptionService.getCurrentSubscription(),
  });

  const availablePropertyTypes: PropertyType[] =
    subscription?.propertyTypes && subscription.propertyTypes.length > 0
      ? subscription.propertyTypes
      : subscription?.propertyType
      ? [subscription.propertyType]
      : ['RealEstate'];
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
