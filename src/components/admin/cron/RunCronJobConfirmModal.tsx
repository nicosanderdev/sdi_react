import { Alert, Button, Modal, ModalBody, ModalFooter, ModalHeader } from 'flowbite-react';
import { AlertTriangleIcon } from 'lucide-react';
import type { AdminCronJobCatalogItem } from '../../../services/AdminCronJobsService';

interface RunCronJobConfirmModalProps {
  job: AdminCronJobCatalogItem | null;
  running: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function RunCronJobConfirmModal({
  job,
  running,
  onClose,
  onConfirm,
}: RunCronJobConfirmModalProps) {
  return (
    <Modal show={job != null} onClose={() => { if (!running) onClose(); }} size="lg">
      <ModalHeader>
        <div className="flex items-center space-x-2">
          <AlertTriangleIcon className="h-5 w-5 text-amber-600" />
          <span>Ejecutar {job?.label ?? 'trabajo'}</span>
        </div>
      </ModalHeader>
      <ModalBody>
        <div className="space-y-4">
          <Alert color="warning" icon={AlertTriangleIcon}>
            Esta ejecución usa el mismo código que el cron. Los efectos son reales.
          </Alert>
          {job && (
            <p className="text-sm text-gray-700 dark:text-gray-300">{job.description}</p>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <div className="flex w-full justify-end gap-2">
          <Button color="light" onClick={onClose} disabled={running}>
            Cancelar
          </Button>
          <Button color="warning" onClick={onConfirm} disabled={running || !job}>
            {running ? 'Ejecutando…' : 'Ejecutar'}
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}
