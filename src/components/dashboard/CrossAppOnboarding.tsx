import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from 'flowbite-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
  hasUsedApp,
  recordAppUsed,
  currentUserHasOwnerRecord,
  APP_NAMES,
} from '../../services/UserAppsService';

const HOST_ONBOARDING_DISMISSED_KEY = 'crossAppHostOnboardingDismissed';

export function CrossAppOnboarding() {
  const { user: supabaseUser } = useAuth();
  const profile = useSelector((state: RootState) => state.user.profile);
  const profileStatus = useSelector((state: RootState) => state.user.status);
  const navigate = useNavigate();

  const [showWelcome, setShowWelcome] = useState(false);
  const [showHostOnboarding, setShowHostOnboarding] = useState(false);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  const runChecks = useCallback(async () => {
    if (!supabaseUser?.id) return;
    setLoading(true);
    try {
      const hasUsedAdminApp = await hasUsedApp(APP_NAMES.ADMIN_APP, supabaseUser.id);
      if (!hasUsedAdminApp) {
        setShowWelcome(true);
        setChecked(true);
        return;
      }
      const hasOwner = await currentUserHasOwnerRecord(supabaseUser.id);
      const dismissed = sessionStorage.getItem(HOST_ONBOARDING_DISMISSED_KEY);
      if (!hasOwner && !dismissed) {
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
        const hasOwner = await currentUserHasOwnerRecord(supabaseUser.id);
        const dismissed = sessionStorage.getItem(HOST_ONBOARDING_DISMISSED_KEY);
        if (!hasOwner && !dismissed) {
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
    sessionStorage.setItem(HOST_ONBOARDING_DISMISSED_KEY, '1');
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
