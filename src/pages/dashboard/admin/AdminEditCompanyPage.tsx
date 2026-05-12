import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Card, Label, Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow, TextInput, Textarea } from 'flowbite-react';
import DashboardPageTitle from '../../../components/dashboard/DashboardPageTitle';
import { useAdminCompanies } from '../../../hooks/useAdminCompanies';
import AddCompanyUserModal from '../../../components/admin/companies/AddCompanyUserModal';
import { CompanyEditStatistics } from '../../../components/admin/companies/CompanyEditStatistics';

export function AdminEditCompanyPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const {
    fetchCompanyDetail,
    updateCompany,
    actionError,
    members,
    addUserByEmail,
    companyDetail,
    detailLoading,
    detailError,
  } = useAdminCompanies();
  const [openAddUser, setOpenAddUser] = useState(false);
  const [name, setName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (companyId) {
      fetchCompanyDetail(companyId);
    }
  }, [companyId, fetchCompanyDetail]);

  useEffect(() => {
    if (!companyDetail?.company) return;
    const c = companyDetail.company;
    setName(c.name);
    setBillingEmail(c.billingEmail ?? '');
    setDescription(c.description ?? '');
    setPhone(c.phone ?? '');
  }, [companyDetail]);

  const canSave = useMemo(() => Boolean(companyId && name.trim() && billingEmail.trim()), [companyId, name, billingEmail]);

  const submitCompany = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!companyId || !canSave) return;
    const ok = await updateCompany(companyId, { name, billingEmail, description, phone });
    if (ok) {
      await fetchCompanyDetail(companyId);
    }
  };

  const createdLabel = companyDetail?.company?.createdAt
    ? new Date(companyDetail.company.createdAt).toLocaleDateString()
    : null;
  const adminLabel =
    detailLoading && !companyDetail
      ? '…'
      : companyDetail
        ? (companyDetail.primaryCompanyAdmin
          ? `${companyDetail.primaryCompanyAdmin.fullName} (${companyDetail.primaryCompanyAdmin.email})`
          : 'Sin administrador identificado')
        : '';
  const showMetadataCard = !detailError && (detailLoading || companyDetail);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <DashboardPageTitle title="Editar compañía" subtitle="Actualiza datos de la compañía y sus usuarios asociados" />
        {showMetadataCard ? (
          <Card className="border-gray-200 dark:border-gray-700">
            <div className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300 sm:flex-row sm:flex-wrap sm:gap-x-8">
              <p>
                <span className="font-medium text-gray-900 dark:text-white">Creada: </span>
                {createdLabel ?? (detailLoading ? '…' : '—')}
              </p>
              <p>
                <span className="font-medium text-gray-900 dark:text-white">Administrador: </span>
                {adminLabel || '—'}
              </p>
            </div>
          </Card>
        ) : null}
      </div>

      {detailError && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-red-700 dark:text-red-200">{detailError}</p>
        </Card>
      )}
      {actionError && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-amber-800 dark:text-amber-100">{actionError}</p>
        </Card>
      )}

      <CompanyEditStatistics statistics={companyDetail?.statistics ?? null} loading={detailLoading} />

      <Card>
        <h3 className="mb-4 text-lg font-semibold">Datos de la compañía</h3>
        <form className="space-y-4" onSubmit={submitCompany}>
          <div>
            <Label>Nombre</Label>
            <TextInput value={name} onChange={e => setName(e.target.value)} disabled={detailLoading && !companyDetail} />
          </div>
          <div>
            <Label>Email de contacto/facturación</Label>
            <TextInput type="email" value={billingEmail} onChange={e => setBillingEmail(e.target.value)} disabled={detailLoading && !companyDetail} />
          </div>
          <div>
            <Label>Teléfono (opcional)</Label>
            <TextInput value={phone} onChange={e => setPhone(e.target.value)} disabled={detailLoading && !companyDetail} />
          </div>
          <div>
            <Label>Descripción (opcional)</Label>
            <Textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} disabled={detailLoading && !companyDetail} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={!canSave || (detailLoading && !companyDetail)}>Guardar cambios</Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Usuarios de la compañía</h3>
          <Button onClick={() => setOpenAddUser(true)}>Agregar usuario</Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableHeadCell>Nombre</TableHeadCell>
              <TableHeadCell>Email</TableHeadCell>
              <TableHeadCell>Rol</TableHeadCell>
            </TableHead>
            <TableBody className="divide-y">
              {members.map(member => (
                <TableRow key={member.id}>
                  <TableCell>{member.fullName}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>{member.role}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <AddCompanyUserModal
        open={openAddUser}
        onClose={() => setOpenAddUser(false)}
        error={actionError}
        onSubmit={async (email) => (companyId ? addUserByEmail(companyId, email) : false)}
      />
    </div>
  );
}
