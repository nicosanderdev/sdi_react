import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from 'flowbite-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { recordAppUsed, currentUserHasOwnerRecord, APP_NAMES, getUserApps } from '../../services/UserAppsService';

const HOST_ONBOARDING_DISMISSED_KEY = 'crossAppHostOnboardingDismissed';

function getHostDismissedKeyForUser(userId: string) {
  return `${HOST_ONBOARDING_DISMISSED_KEY}:${userId}`;
}

export function CrossAppOnboarding() {
  const { user: supabaseUser } = useAuth();
  const profile = useSelector((state: RootState) => state.user.profile);
  const profileStatus = useSelector((state: RootState) => state.user.status);
  const navigate = useNavigate();

  const [showWelcome, setShowWelcome] = useState(false);
  const [showHostOnboarding, setShowHostOnboarding] = useState(false);
  const [checked, setChecked] = useState(false);
  const [, setLoading] = useState(false);

  const runChecks = useCallback(async () => {
    if (!supabaseUser?.id) return;
    setLoading(true);
    try {
      const userId = supabaseUser.id;

      // Fetch all app usage once so we can reason about cross-app usage.
      const userApps = await getUserApps(userId);
      const hasUsedAdminApp = userApps.some((r) => r.AppName === APP_NAMES.ADMIN_APP);
      const hasUsedOtherApp = userApps.some(
        (r) => r.AppName === APP_NAMES.RENTALS_APP || r.AppName === APP_NAMES.VENUES_APP
      );

      const hasOwner = await currentUserHasOwnerRecord(userId);
      const hostDismissed =
        typeof window !== 'undefined'
          ? window.localStorage.getItem(getHostDismissedKeyForUser(userId))
          : null;

      console.debug('CrossAppOnboarding runChecks:', {
        userId,
        hasUsedAdminApp,
        hasUsedOtherApp,
        hasOwner,
        hostDismissed,
      });

      // Welcome modal: only when user has used another app but not the admin app yet.
      if (!hasUsedAdminApp && hasUsedOtherApp) {
        setShowWelcome(true);
        setChecked(true);
        return;
      }

      // Host onboarding: no owner record and user hasn't dismissed it yet.
      if (!hasOwner && !hostDismissed) {
        setShowHostOnboarding(true);
      }
    } catch (e) {
      console.error('CrossAppOnboarding runChecks:', e);
    } finally {
      setLoading(false);
      setChecked(true);
    }
  }, [supabaseUser?.id]);

  useEffect(() => {
    if (!supabaseUser || !profile || profileStatus !== 'succeeded' || checked) return;
    runChecks();
  }, [supabaseUser, profile, profileStatus, checked, runChecks]);

  const handleWelcomeContinue = async () => {
    if (!supabaseUser?.id) return;
    setShowWelcome(false);
    try {
      const ok = await recordAppUsed(APP_NAMES.ADMIN_APP, supabaseUser.id);
      if (ok) {
        const userId = supabaseUser.id;
        const hasOwner = await currentUserHasOwnerRecord(userId);
        const hostDismissed =
          typeof window !== 'undefined'
            ? window.localStorage.getItem(getHostDismissedKeyForUser(userId))
            : null;
        console.debug('CrossAppOnboarding handleWelcomeContinue:', {
          userId,
          ok,
          hasOwner,
          hostDismissed,
        });
        if (!hasOwner && !hostDismissed) {
          setShowHostOnboarding(true);
        }
      }
    } catch (e) {
      console.error('CrossAppOnboarding handleWelcomeContinue:', e);
    }
  };

  const handleBecomeHost = () => {
    setShowHostOnboarding(false);
    navigate('/dashboard/subscription');
  };

  const handleMaybeLater = () => {
    if (supabaseUser?.id && typeof window !== 'undefined') {
      window.localStorage.setItem(getHostDismissedKeyForUser(supabaseUser.id), '1');
      console.debug('CrossAppOnboarding handleMaybeLater: set host dismissed flag', {
        userId: supabaseUser.id,
      });
    }
    setShowHostOnboarding(false);
  };

  if (!supabaseUser || !profile) return null;

  return (
    <>
      {/* Welcome modal: first time in admin app (shared account message) */}
      <Modal
        show={showWelcome}
        size="md"
        onClose={() => setShowWelcome(false)}
        dismissible={false}
      >
        <ModalHeader>Bienvenido al Panel de Administración.</ModalHeader>
        <ModalBody>
          <p className="text-gray-700 dark:text-gray-300">
            Tu cuenta se comparte entre nuestras plataformas. Es posible que ya hayas usado esta
            cuenta para buscar alojamientos. Este sitio es la plataforma de gestión donde los
            propietarios y los venues gestionan anuncios, reservas y mensajes. Puedes usar la misma
            cuenta en todos nuestros servicios.
          </p>
        </ModalBody>
        <ModalFooter className='flex justify-center gap-2'>
          <Button color="green" onClick={handleWelcomeContinue}>
            Continuar
          </Button>
        </ModalFooter>
      </Modal>

      {/* Host onboarding: no Owner record yet */}
      <Modal
        show={showHostOnboarding}
        size="md"
        onClose={handleMaybeLater}
        dismissible
      >
        <ModalHeader>¿Quieres publicar una propiedad o un local?</ModalHeader>
        <ModalBody>
          <p className="text-gray-700 dark:text-gray-300">
            Puedes registrarte como anfitrión para publicar propiedades y gestionar reservas desde
            este panel.
          </p>
        </ModalBody>
        <ModalFooter className='flex justify-center gap-2'>
          <Button color="alternative" onClick={handleMaybeLater}>
            Quizás más tarde
          </Button>
          <Button color="green" onClick={handleBecomeHost}>
            Ser anfitrión
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
