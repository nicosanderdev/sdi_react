import { Badge, Button, Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from 'flowbite-react';
import { useNavigate } from 'react-router-dom';
import { UseAdminCompaniesReturn } from '../../../hooks/useAdminCompanies';

interface Props {
  hook: UseAdminCompaniesReturn;
}

export function CompaniesTable({ hook }: Props) {
  const navigate = useNavigate();
  const { companies, loading } = hook;

  if (loading && companies.length === 0) {
    return <div className="py-10 text-center text-gray-500">Cargando compañías...</div>;
  }
  if (companies.length === 0) {
    return <div className="py-10 text-center text-gray-500">No hay compañías para mostrar.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <Table hoverable>
        <TableHead>
          <TableHeadCell>Nombre</TableHeadCell>
          <TableHeadCell>Email</TableHeadCell>
          <TableHeadCell>Fecha de creación</TableHeadCell>
          <TableHeadCell>Estado</TableHeadCell>
          <TableHeadCell>Miembros</TableHeadCell>
          <TableHeadCell>Acciones</TableHeadCell>
        </TableHead>
        <TableBody className="divide-y">
          {companies.map(company => (
            <TableRow key={company.id}>
              <TableCell className="font-medium text-gray-900 dark:text-white">{company.name}</TableCell>
              <TableCell>{company.billingEmail}</TableCell>
              <TableCell>{new Date(company.createdAt).toLocaleDateString()}</TableCell>
              <TableCell>
                <Badge color={company.status === 'active' ? 'success' : 'failure'}>
                  {company.status === 'active' ? 'Activa' : 'Eliminada'}
                </Badge>
              </TableCell>
              <TableCell>{company.membersCount}</TableCell>
              <TableCell>
                <Button size="xs" color="light" onClick={() => navigate(`/dashboard/admin/companies/${company.id}/edit`)}>
                  Editar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
