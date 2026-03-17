import React, { useState } from 'react';
import { Card } from 'flowbite-react';
import { useOwnerOnboarding } from '../../hooks/useOwnerOnboarding';
import { OwnerOnboardingTour } from '../../components/onboarding/OwnerOnboardingTour';
import { PropertyCreationWizard } from '../../components/dashboard/properties/PropertyCreationWizard';
import { SuccessDisplay } from '../../components/ui/SuccessDisplay';
interface AddPropertyFormProps {
  onClose: () => void;
}

export function AddPropertyForm({ onClose }: AddPropertyFormProps) {
  const [view, setView] = useState<'form' | 'success'>('form');
  const [showOnboardingSuccessMessage, setShowOnboardingSuccessMessage] = useState(false);
  const {
    isEligibleForOnboarding,
    isFreePlan,
    planPublishedLimit,
    currentStep: onboardingStep,
    setStep,
    complete,
  } = useOwnerOnboarding();
  return (
    <Card className="min-h-full">
      {view === 'form' && (
        <div id="onboarding-plan-limit">
          <PropertyCreationWizard
            initialContext={{
              mode: 'user',
              isAdmin: false,
              availablePropertyTypes: ['RealEstate', 'AnnualRent', 'SummerRent', 'EventVenue'],
            }}
            onComplete={async () => {
              if (isEligibleForOnboarding) {
                setShowOnboardingSuccessMessage(true);
                await complete();
              }
              setView('success');
            }}
            onClose={onClose}
          />
        </div>
      )}
      {view === 'success' && (
        <SuccessDisplay
          title={showOnboardingSuccessMessage ? 'Your property has been published!' : '¡Registro de propiedad exitoso!'}
          message={showOnboardingSuccessMessage ? 'You can view and manage it from your properties list.' : 'La propiedad ha sido registrada correctamente.'}
          redirectUrl="/dashboard/properties"
        />
      )}
      {/* Owner onboarding: Plan limit (Free plan only) */}
      {view === 'form' && isEligibleForOnboarding && isFreePlan && currentStep === 1 && onboardingStep <= 2 && (
        <OwnerOnboardingTour
          active={true}
          step={{
            element: '#onboarding-plan-limit',
            title: 'Free Plan',
            description: `You're using the Free Plan, which allows up to ${planPublishedLimit} properties. Reservations made through this plan include a commission fee.`,
            nextBtnText: 'Continue',
          }}
          onNext={() => setStep(3)}
          onDismiss={() => {}}
        />
      )}

      {/* Owner onboarding: Step 4a — Description, pricing, availability (form step 2) */}
      {view === 'form' && isEligibleForOnboarding && currentStep === 2 && (
        <OwnerOnboardingTour
          active={true}
          step={{
            element: '#onboarding-form-details',
            title: 'Property details',
            description:
              'Add a property description, set pricing, and set availability. These help guests find and book your property.',
            nextBtnText: 'Next',
          }}
          onNext={() => {}}
          onDismiss={() => {}}
        />
      )}

      {/* Owner onboarding: Step 4b — Photos (form step 3) */}
      {view === 'form' && isEligibleForOnboarding && currentStep === 3 && (
        <OwnerOnboardingTour
          active={true}
          step={{
            element: '#onboarding-form-photos',
            title: 'Add photos',
            description:
              'Photos help your listing stand out. Add clear images of the property, rooms, and amenities.',
            nextBtnText: 'Next',
          }}
          onNext={() => {}}
          onDismiss={() => {}}
        />
      )}
    </Card>
  );
}