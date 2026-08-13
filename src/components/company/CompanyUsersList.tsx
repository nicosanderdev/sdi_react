import React, { useState } from 'react';
import { Card, Button, Table, Badge, Spinner, Alert, TableHead, TableHeadCell, TableCell, TableBody, TableRow, Select } from 'flowbite-react';
import { Users, UserPlus, Trash2, AlertCircle } from 'lucide-react';
import { CompanyUser } from '../../models/companies/CompanyUser';
import companyService from '../../services/CompanyService';
import { AddUserModal } from './AddUserModal';
import { resolveAssetUrl } from '../../utils/resolveAssetUrl';

interface CompanyUsersListProps {
  users: CompanyUser[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  canManage?: boolean;
  companyId?: string;
}

const ROLES: Array<'Admin' | 'Manager' | 'Member'> = ['Admin', 'Manager', 'Member'];

export function CompanyUsersList({
  users,
  isLoading,
  error,
  onRefresh,
  canManage = false,
  companyId,
}: CompanyUsersListProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleRemoveUser = async (membershipId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este usuario de la empresa?')) {
      return;
    }

    setActionError(null);
    setRemovingUserId(membershipId);
    try {
      await companyService.removeUserFromCompany(membershipId);
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Error al eliminar el usuario');
    } finally {
      setRemovingUserId(null);
    }
  };

  const handleRoleChange = async (membershipId: string, role: 'Admin' | 'Manager' | 'Member') => {
    setActionError(null);
    setUpdatingRoleId(membershipId);
    try {
      await companyService.updateCompanyMemberRole(membershipId, role);
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Error al cambiar el rol');
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'failure';
      case 'manager':
        return 'warning';
      case 'member':
      case 'user':
        return 'info';
      default:
        return 'gray';
    }
  };

  if (error) {
    return (
      <Card>
        <Alert color="failure" icon={AlertCircle}>
          <span className="font-medium">Error:</span> {error}
        </Alert>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Users className="w-6 h-6" />
            <h2 className="text-xl font-bold">Usuarios de la empresa</h2>
          </div>
          {canManage && (
            <Button
              onClick={() => setShowAddModal(true)}
              className="flex items-center space-x-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Agregar Usuario</span>
            </Button>
          )}
        </div>

        {actionError && (
          <Alert color="failure" icon={AlertCircle} className="mb-4">
            {actionError}
          </Alert>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="xl" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay usuarios</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Comienza agregando usuarios a tu empresa.
            </p>
            {canManage && (
              <Button
                onClick={() => setShowAddModal(true)}
                color="blue"
                className="flex items-center space-x-2 mx-auto"
              >
                <UserPlus className="w-4 h-4" />
                <span>Agregar Primer Usuario</span>
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table hoverable>
              <TableHead>
                <TableHeadCell>Nombre</TableHeadCell>
                <TableHeadCell>Correo</TableHeadCell>
                <TableHeadCell>Rol</TableHeadCell>
                <TableHeadCell>Fecha de Ingreso</TableHeadCell>
                {canManage && (
                  <TableHeadCell>
                    <span className="sr-only">Acciones</span>
                  </TableHeadCell>
                )}
              </TableHead>
              <TableBody className="divide-y">
                {users.map((user) => (
                  <TableRow key={user.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <TableCell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                      <div className="flex items-center space-x-3">
                        {user.avatarUrl ? (
                          <img
                            src={resolveAssetUrl(user.avatarUrl)}
                            alt={`${user.firstName} ${user.lastName}`}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                            </span>
                          </div>
                        )}
                        <span>
                          {user.firstName} {user.lastName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {canManage ? (
                        <Select
                          sizing="sm"
                          value={user.role}
                          disabled={updatingRoleId === user.id}
                          onChange={e =>
                            handleRoleChange(
                              user.id,
                              e.target.value as 'Admin' | 'Manager' | 'Member'
                            )
                          }
                        >
                          {ROLES.map(role => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Badge color={getRoleBadgeColor(user.role)}>{user.role}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(user.joinDate)}</TableCell>
                    {canManage && (
                      <TableCell>
                        <Button
                          onClick={() => handleRemoveUser(user.id)}
                          color="alternative"
                          size="sm"
                          disabled={removingUserId === user.id}
                          className="flex items-center space-x-1"
                        >
                          {removingUserId === user.id ? (
                            <>
                              <Spinner size="sm" />
                              <span>Eliminando...</span>
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4" />
                              <span>Eliminar</span>
                            </>
                          )}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {canManage && (
        <AddUserModal
          show={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={onRefresh}
          companyId={companyId}
        />
      )}
    </>
  );
}
