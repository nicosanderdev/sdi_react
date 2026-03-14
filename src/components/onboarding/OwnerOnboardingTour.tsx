import { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export interface OwnerOnboardingStepConfig {
  element: string;
  title: string;
  description: string;
  nextBtnText?: string;
  /** If true, show "Skip" / close as dismiss. */
  showDismiss?: boolean;
}

interface OwnerOnboardingTourProps {
  /** When true, the tour step is shown. */
  active: boolean;
  step: OwnerOnboardingStepConfig | null;
  onNext?: () => void;
  onDismiss?: () => void;
}

export function OwnerOnboardingTour({
  active,
  step,
  onNext,
  onDismiss,
}: OwnerOnboardingTourProps) {
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);
  const onNextRef = useRef(onNext);
  const onDismissRef = useRef(onDismiss);
  onNextRef.current = onNext;
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!active || !step) {
      driverRef.current?.destroy();
      driverRef.current = null;
      return;
    }

    const element = document.querySelector(step.element);
    if (!element) {
      return;
    }

    const driverObj = driver({
      showProgress: false,
      allowClose: true,
      overlayClickBehavior: 'close',
      steps: [
        {
          element: step.element,
          popover: {
            title: step.title,
            description: step.description,
            side: 'bottom',
            align: 'start',
            showButtons: ['next', 'close'],
            nextBtnText: step.nextBtnText ?? 'Next',
            onNextClick: () => {
              onNextRef.current?.();
              driverObj.destroy();
            },
            onCloseClick: () => {
              onDismissRef.current?.();
              driverObj.destroy();
            },
          },
        },
      ],
      onDestroyed: () => {
        driverRef.current = null;
      },
    });

    driverRef.current = driverObj;
    driverObj.drive(0);

    return () => {
      driverObj.destroy();
      driverRef.current = null;
    };
  }, [active, step?.element, step?.title, step?.description, step?.nextBtnText]);

  return null;
}
