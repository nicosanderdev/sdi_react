import { Button, Modal, ModalBody, ModalHeader } from 'flowbite-react';
import {
  GUEST_PREVIEW_SITE_LABEL,
  type PropertyPreviewTarget,
} from '../../../services/propertyPreview';

interface PropertyPreviewChooserProps {
  open: boolean;
  targets: PropertyPreviewTarget[];
  busy?: boolean;
  onClose: () => void;
  onChoose: (target: PropertyPreviewTarget) => void;
}

export function PropertyPreviewChooser({
  open,
  targets,
  busy = false,
  onClose,
  onChoose,
}: PropertyPreviewChooserProps) {
  return (
    <Modal show={open} onClose={busy ? undefined : onClose} size="md">
      <ModalHeader>¿Dónde querés ver la vista previa?</ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-3">
          {targets.map((target) => (
            <Button
              key={target.listingType}
              color="light"
              disabled={busy}
              onClick={() => onChoose(target)}
              className="justify-start"
            >
              <span className="flex flex-col items-start text-left">
                <span className="font-medium">{GUEST_PREVIEW_SITE_LABEL[target.listingType]}</span>
                <span className="text-xs font-normal text-gray-500">
                  {target.hiddenFromGuests
                    ? 'Todavía oculta para los huéspedes'
                    : 'Visible para los huéspedes'}
                </span>
              </span>
            </Button>
          ))}
        </div>
      </ModalBody>
    </Modal>
  );
}
