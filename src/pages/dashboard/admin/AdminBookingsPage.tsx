import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { Card, Badge, TextInput, Select, Button } from 'flowbite-react';
import DashboardPageTitle from '../../../components/dashboard/DashboardPageTitle';

export function AdminBookingsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'current' | 'past' | 'rejected'>('all');

  const totalVisibleBookings = 0;

  return (
    <div className="space-y-6">
      <DashboardPageTitle title="Reservas (Administrador)" />

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1">
          <TextInput
            type="text"
            placeholder="Buscar por huésped, email o propiedad..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={Search}
          />
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'all' | 'pending' | 'current' | 'past' | 'rejected')
            }
          >
            <option value="all">Todas las reservas</option>
            <option value="pending">Pendientes</option>
            <option value="current">Próximas / Actuales</option>
            <option value="rejected">Rechazadas / Canceladas</option>
            <option value="past">Pasadas</option>
          </Select>
          {(searchQuery.trim() !== '' || statusFilter !== 'all') && (
            <Button
              color="light"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
            >
              Limpiar filtros
            </Button>
          )}
          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
            Mostrando {totalVisibleBookings} reserva{totalVisibleBookings === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Pendientes */}
      <section>
        <Card>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-primary-900 dark:text-primary-50">
                Pendientes
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Reservas enviadas por usuarios que puedes aceptar o rechazar.
              </p>
            </div>
            <Badge color="warning" className="self-start">
              0
            </Badge>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-center py-6">
            No hay reservas pendientes.
          </p>
        </Card>
      </section>

      {/* Próximas / Actuales */}
      <section>
        <Card>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-primary-900 dark:text-primary-50">
                Próximas / Actuales
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Reservas aceptadas que aún no han terminado.
              </p>
            </div>
            <Badge color="success" className="self-start">
              0
            </Badge>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-center py-6">
            No hay reservas próximas o en curso.
          </p>
        </Card>
      </section>

      {/* Rechazadas / Canceladas */}
      <section>
        <Card>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-primary-900 dark:text-primary-50">
                Rechazadas / Canceladas
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Reservas que rechazaste o cancelaste.
              </p>
            </div>
            <Badge color="failure" className="self-start">
              0
            </Badge>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-center py-6">
            No hay reservas rechazadas o canceladas.
          </p>
        </Card>
      </section>

      {/* Pasadas */}
      <section>
        <Card>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-primary-900 dark:text-primary-50">
                Pasadas
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Historial de reservas ya finalizadas (aceptadas o rechazadas).
              </p>
            </div>
            <Badge color="gray" className="self-start">
              0
            </Badge>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-center py-6">
            No hay reservas pasadas.
          </p>
        </Card>
      </section>
    </div>
  );
}
