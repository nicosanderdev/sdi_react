import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Spinner, Alert, Button, Card } from 'flowbite-react';
import { Building2, AlertCircle, Plus } from 'lucide-react';
import DashboardPageTitle from '../../../components/dashboard/DashboardPageTitle';
import { CompanyInfoCard } from '../../../components/company/CompanyInfoCard';
import { CompanyUsersList } from '../../../components/company/CompanyUsersList';
import { CompanyProfileEditor } from '../../../components/company/CompanyProfileEditor';
import { CreateCompanyModal } from '../../../components/company/CreateCompanyModal';
import companyService from '../../../services/CompanyService';
import subscriptionService from '../../../services/SubscriptionService';
import propertyService from '../../../services/PropertyService';
import messageService from '../../../services/MessageService';
import reportService from '../../../services/ReportService';

export function CompanyManagementPage() {
  const [showCreateCompanyModal, setShowCreateCompanyModal] = useState(false);

  // Fetch company info
  const {
    data: companyInfo,
    isLoading: isLoadingCompanyInfo,
    error: companyInfoError,
    refetch: refetchCompanyInfo,
  } = useQuery({
    queryKey: ['companyInfo'],
    queryFn: async () => {
      const [info, subscription, propertiesData, messageCounts, totalsData] = await Promise.all([
        companyService.getCompanyInfo().catch(() => null),
        subscriptionService.getCurrentSubscription().catch(() => null),
        propertyService.getOwnersProperties({ pageSize: 1 }).catch(() => null),
        messageService.getMessageCounts().catch(() => null),
        reportService.getGeneralTotals().catch(() => null),
      ]);

      // Merge all data into company info
      const mergedInfo: any = info || {
        id: '',
        name: '',
        createdAt: new Date().toISOString(),
      };

      if (subscription) {
        mergedInfo.subscription = {
          planName: subscription.plan.name,
          endDate: subscription.currentPeriodEnd,
        };
      }

      // Add statistics if not present in company info
      if (!mergedInfo.statistics) {
        mergedInfo.statistics = {
          totalProperties: propertiesData?.total || 0,
          unansweredMessages: messageCounts?.inbox || 0,
          totalVisits: totalsData?.totalVisitsLifetime || 0,
        };
      } else {
        // Enhance existing statistics with fetched data if missing
        mergedInfo.statistics = {
          totalProperties: mergedInfo.statistics.totalProperties || propertiesData?.total || 0,
          unansweredMessages: mergedInfo.statistics.unansweredMessages || messageCounts?.inbox || 0,
          totalVisits: mergedInfo.statistics.totalVisits || totalsData?.totalVisitsLifetime || 0,
        };
      }

      return mergedInfo;
    },
  });

  // Fetch company users
  const {
    data: companyUsers = [],
    isLoading: isLoadingUsers,
    error: usersError,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ['companyUsers'],
    queryFn: () => companyService.getCompanyUsers(),
  });

  // Use companyInfo directly as it's already enhanced with statistics
  const enhancedCompanyInfo = companyInfo;

  const handleRefresh = () => {
    refetchCompanyInfo();
    refetchUsers();
  };

  const handleCreateCompanySuccess = (newCompany: any) => {
    // Refresh the data after creating a company
    refetchCompanyInfo();
    refetchUsers();
  };

  const isLoading = isLoadingCompanyInfo || isLoadingUsers;
  const error = companyInfoError || usersError;
  const hasNoCompany = error && error instanceof Error && error.message.includes('not a member of any company');

  return (
    <div className="space-y-6">
      <DashboardPageTitle title="Gestión de Empresa" />

      {error && !hasNoCompany && (
        <Alert color="failure" icon={AlertCircle}>
          <span className="font-medium">Error:</span>{' '}
          {error instanceof Error ? error.message : 'Error al cargar la información de la compañía'}
        </Alert>
      )}

      {hasNoCompany ? (
        // No company state - show create company option
        <div className="space-y-6">
          <Card>
            <div className="text-center py-12">
              <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No tienes una compañía</h3>
              <p className="text-gray-600 mb-6">
                Crea una compañía para gestionar propiedades y usuarios de forma colaborativa.
              </p>
              <Button
                onClick={() => setShowCreateCompanyModal(true)}
                className="bg-[#1B4965] text-white px-6 py-3 rounded-lg hover:bg-[#153a52] transition-colors flex items-center space-x-2 mx-auto"
              >
                <Plus className="w-5 h-5" />
                <span>Crear Compañía</span>
              </Button>
            </div>
          </Card>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="xl" />
        </div>
      ) : (
        <>
          {/* Company Information Summary */}
          <section>
            <CompanyInfoCard
              companyInfo={enhancedCompanyInfo}
              isLoading={isLoadingCompanyInfo}
              error={companyInfoError ? (companyInfoError instanceof Error ? companyInfoError.message : 'Error desconocido') : null}
            />
          </section>

          {/* Company Profile Editor */}
          <section>
            <CompanyProfileEditor
              companyInfo={enhancedCompanyInfo}
              isLoading={isLoadingCompanyInfo}
              onUpdate={handleRefresh}
            />
          </section>

          {/* Company Users Management */}
          <section>
            <CompanyUsersList
              users={companyUsers}
              isLoading={isLoadingUsers}
              error={usersError ? (usersError instanceof Error ? usersError.message : 'Error desconocido') : null}
              onRefresh={handleRefresh}
            />
          </section>
        </>
      )}

      <CreateCompanyModal
        show={showCreateCompanyModal}
        onClose={() => setShowCreateCompanyModal(false)}
        onSuccess={handleCreateCompanySuccess}
      />
    </div>
  );
}

