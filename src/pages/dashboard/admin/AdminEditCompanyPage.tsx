import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Card, Label, Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow, TextInput, Textarea } from 'flowbite-react';
import DashboardPageTitle from '../../../components/dashboard/DashboardPageTitle';
import { useAdminCompanies } from '../../../hooks/useAdminCompanies';
import companyService from '../../../services/CompanyService';
import AddCompanyUserModal from '../../../components/admin/companies/AddCompanyUserModal';

export function AdminEditCompanyPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const { fetchCompanyDetail, updateCompany, actionError, members, addUserByEmail } = useAdminCompanies();
  const [openAddUser, setOpenAddUser] = useState(false);
  const [name, setName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [companyError, setCompanyError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!companyId) return;
      try {
        const detail = await companyService.getAdminCompanyDetail(companyId);
        setName(detail.company.name);
        setBillingEmail(detail.company.billingEmail ?? '');
        setDescription(detail.company.description ?? '');
        setPhone(detail.company.phone ?? '');
      } catch (err: any) {
        setCompanyError(err.message || 'No se pudo cargar la compañía.');
      }
    };
    load();
  }, [companyId]);

  useEffect(() => {
    if (companyId) {
      fetchCompanyDetail(companyId);
    }
  }, [companyId, fetchCompanyDetail]);

  const canSave = useMemo(() => Boolean(companyId && name.trim() && billingEmail.trim()), [companyId, name, billingEmail]);

  const submitCompany = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!companyId || !canSave) return;
    await updateCompany(companyId, { name, billingEmail, description, phone });
  };

  return (
    <div className="space-y-6">
      <DashboardPageTitle title="Editar compañía" subtitle="Actualiza datos de la compañía y sus usuarios asociados" />

      {companyError && <Card className="border-red-200 bg-red-50"><p className="text-red-700">{companyError}</p></Card>}
      {actionError && <Card className="border-amber-200 bg-amber-50"><p className="text-amber-800">{actionError}</p></Card>}

      <Card>
        <h3 className="mb-4 text-lg font-semibold">Datos de la compañía</h3>
        <form className="space-y-4" onSubmit={submitCompany}>
          <div>
            <Label>Nombre</Label>
            <TextInput value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <Label>Email de contacto/facturación</Label>
            <TextInput type="email" value={billingEmail} onChange={e => setBillingEmail(e.target.value)} />
          </div>
          <div>
            <Label>Teléfono (opcional)</Label>
            <TextInput value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div>
            <Label>Descripción (opcional)</Label>
            <Textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={!canSave}>Guardar cambios</Button>
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
