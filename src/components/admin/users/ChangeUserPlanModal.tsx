import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from 'flowbite-react';
import { AdminPlanAssignFields } from '../plans/AdminPlanAssignFields';
import { useAdminAssignablePlans } from '../../../hooks/useAdminAssignablePlans';
import type { UseAdminUsersReturn } from '../../../hooks/useAdminUsers';
import type { UserListItem } from '../../../services/UserAdminService';

function userDisplayName(user: UserListItem): string {
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return name || user.email;
}

interface ChangeUserPlanModalProps {
  hook: UseAdminUsersReturn;
}

export function ChangeUserPlanModal({ hook }: ChangeUserPlanModalProps) {
  const {
    changePlanModalOpen,
    userToChangePlan,
    closeChangePlanModal,
    confirmChangeMemberPlan,
    actionLoading,
    actionError,
  } = hook;

  const subjectId = changePlanModalOpen ? userToChangePlan?.id ?? null : null;
  const {
    plans,
    currentPlan,
    loading,
    error,
    selectedPlanId,
    setSelectedPlanId,
    canSubmit,
  } = useAdminAssignablePlans('member', subjectId);

  if (!userToChangePlan) return null;

  const handleConfirm = () => {
    if (!canSubmit || actionLoading) return;
    void confirmChangeMemberPlan(userToChangePlan.id, selectedPlanId);
  };

  return (
    <Modal show={changePlanModalOpen} onClose={closeChangePlanModal} size="lg">
      <ModalHeader>
        Cambiar plan a usuario {userDisplayName(userToChangePlan)}
      </ModalHeader>
      <ModalBody>
        <AdminPlanAssignFields
          idPrefix="admin-change-user-plan"
          plans={plans}
          currentPlan={currentPlan}
          loading={loading}
          plansError={error}
          selectedPlanId={selectedPlanId}
          onSelectedPlanIdChange={setSelectedPlanId}
          submitError={actionError}
        />
      </ModalBody>
      <ModalFooter>
        <Button color="gray" onClick={closeChangePlanModal} disabled={actionLoading}>
          Cancelar
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!canSubmit || actionLoading}
          data-testid="admin-change-user-plan-confirm"
        >
          {actionLoading ? 'Cambiando…' : 'Cambiar plan'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
