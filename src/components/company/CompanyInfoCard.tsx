import React from 'react';
import { Card } from 'flowbite-react';
import { 
  Building2, 
  Calendar, 
  Home, 
  MessageSquare, 
  Eye, 
  Crown,
  MapPin
} from 'lucide-react';
import { CompanyInfo } from '../../models/companies/CompanyInfo';
import { DashboardCard } from '../dashboard/DashboardCard';

interface CompanyInfoCardProps {
  companyInfo: CompanyInfo | null;
  isLoading: boolean;
  error: string | null;
}

export function CompanyInfoCard({ companyInfo, isLoading, error }: CompanyInfoCardProps) {
  if (error) {
    return (
      <Card>
        <div className="text-center py-8">
          <p className="text-red-600">{error}</p>
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <div className="text-center py-8">
          <p className="text-gray-500">Cargando información de la empresa...</p>
        </div>
      </Card>
    );
  }

  if (!companyInfo) {
    return (
      <Card>
        <div className="text-center py-8">
          <p className="text-gray-500">No se encontró información de la empresa</p>
        </div>
      </Card>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Company Header */}
      <Card>
        <div className="flex items-start space-x-4">
          {companyInfo.logoUrl && (
            <img 
              src={companyInfo.logoUrl} 
              alt={companyInfo.name}
              className="w-20 h-20 rounded-lg object-cover"
            />
          )}
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">{companyInfo.name}</h2>
            {companyInfo.description && (
              <p className="text-gray-600 dark:text-gray-400 mb-4">{companyInfo.description}</p>
            )}
            {companyInfo.address && (
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <MapPin className="w-4 h-4 mr-2" />
                <span>
                  {companyInfo.address.street}
                  {companyInfo.address.street2 && `, ${companyInfo.address.street2}`}
                  {`, ${companyInfo.address.city}, ${companyInfo.address.state} ${companyInfo.address.postalCode}, ${companyInfo.address.country}`}
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <DashboardCard
                title="Fecha de Creación"
                icon={Calendar}
                value={formatDate(companyInfo.createdAt)}
                className='max-h-fit'
                subtitle={
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                        Agregada por Nicolás
                    </span>
                }
            />
            
            {companyInfo.subscription && (
            <DashboardCard
                title="Fin de Suscripción"
                icon={Crown}
                value={formatDate(companyInfo.subscription.endDate)}
                subtitle={
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                        Plan: {companyInfo.subscription.planName}
                    </span>
                }
            />
            )}

        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {companyInfo.statistics && (
            <>
                <DashboardCard
                title="Propiedades"
                icon={Home}
                value={companyInfo.statistics.totalProperties || 0}
                />
                
                <DashboardCard
                title="Mensajes sin Responder"
                icon={MessageSquare}
                value={companyInfo.statistics.unansweredMessages || 0}
                />
                
                <DashboardCard
                title="Visitas Totales"
                icon={Eye}
                value={companyInfo.statistics.totalVisits || 0}
                />
            </>
            )}
      </div>
    </div>
  );
}

