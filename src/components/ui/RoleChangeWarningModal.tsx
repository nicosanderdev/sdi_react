import React from 'react';
import { Modal, Button } from 'flowbite-react';
import { AlertTriangle, Building2, Users, EyeOff } from 'lucide-react';
import { RoleChangeWarning } from '../../store/slices/subscriptionSlice';

interface RoleChangeWarningModalProps {
  warning: RoleChangeWarning;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RoleChangeWarningModal({
  warning,
  onConfirm,
  onCancel
}: RoleChangeWarningModalProps) {
  if (!warning.isVisible) return null;

  const consequences = [
    {
      icon: <Building2 className="w-6 h-6 text-red-600" />,
      title: 'Company Access Loss',
      description: 'You will lose access to all company properties and management features.'
    },
    {
      icon: <Users className="w-6 h-6 text-red-600" />,
      title: 'Admin Privileges Removed',
      description: 'You will no longer be able to manage company users or settings.'
    },
    {
      icon: <EyeOff className="w-6 h-6 text-red-600" />,
      title: 'Property Visibility Limited',
      description: 'Only your own properties will be visible. Company properties will be hidden.'
    }
  ];

  return (
    <Modal
      show={warning.isVisible}
      size="lg"
      onClose={onCancel}
      className="role-change-warning-modal"
    >
      <Modal.Header>
        <div className="flex items-center space-x-3">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Role Change Warning
          </h3>
        </div>
      </Modal.Header>

      <Modal.Body>
        <div className="space-y-6">
          {/* Main Warning */}
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-red-900 mb-2">
                  Changing Role from Admin to Manager
                </h4>
                <p className="text-red-800 text-sm">
                  You are about to change your role from Company Admin to Manager.
                  This action will have significant consequences for your access and capabilities.
                </p>
              </div>
            </div>
          </div>

          {/* Affected Companies */}
          {warning.affectedCompanies.length > 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-semibold text-yellow-900 mb-2">Affected Companies:</h4>
              <ul className="list-disc list-inside text-yellow-800 text-sm space-y-1">
                {warning.affectedCompanies.map((companyName, index) => (
                  <li key={index}>{companyName}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Consequences */}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
              What will happen after this change:
            </h4>
            <div className="grid gap-4">
              {consequences.map((consequence, index) => (
                <div
                  key={index}
                  className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex-shrink-0">
                    {consequence.icon}
                  </div>
                  <div>
                    <h5 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {consequence.title}
                    </h5>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {consequence.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Confirmation Message */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-sm">
              <strong>Are you sure you want to proceed?</strong> This action cannot be undone.
              You will need to contact a company administrator to regain admin privileges.
            </p>
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <div className="flex justify-end space-x-3 w-full">
          <Button
            color="gray"
            onClick={onCancel}
            className="px-6"
          >
            Cancel
          </Button>
          <Button
            color="red"
            onClick={onConfirm}
            className="px-6"
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Proceed with Role Change
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}

