import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Spinner, Alert, Button, Card } from 'flowbite-react';
import { AlertCircle, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardPageTitle from '../../../components/dashboard/DashboardPageTitle';
import { CompanyInfoCard } from '../../../components/company/CompanyInfoCard';
import { CompanyUsersList } from '../../../components/company/CompanyUsersList';
import { CompanyProfileEditor } from '../../../components/company/CompanyProfileEditor';
import companyService from '../../../services/CompanyService';
import subscriptionService from '../../../services/SubscriptionService';
import propertyService from '../../../services/PropertyService';
import messageService from '../../../services/MessageService';
import reportService from '../../../services/ReportService';

export function CompanyManagementPage() {
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const navigate = useNavigate();

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

  // Fetch company subscription
  const {
    data: companySubscription,
    isLoading: isLoadingSubscription,
    error: subscriptionError,
  } = useQuery({
    queryKey: ['companySubscription', companyInfo?.id],
    queryFn: () => companyInfo?.id ? subscriptionService.getCompanySubscription(companyInfo.id) : Promise.reject(new Error('No company ID')),
    enabled: !!companyInfo?.id,
  });

  // Use companyInfo directly as it's already enhanced with statistics
  const enhancedCompanyInfo = companyInfo;

  const handleRefresh = () => {
    refetchCompanyInfo();
    refetchUsers();
  };


  const isLoading = isLoadingCompanyInfo || isLoadingUsers || isLoadingSubscription;
  const error = companyInfoError || usersError || subscriptionError;
  const hasNoCompany = error && error instanceof Error && error.message.includes('not a member of any company');
  const hasCompanyButNoSubscription = companyInfo && !isLoadingSubscription && !companySubscription;

  // Redirect to company subscription flow if no company
  useEffect(() => {
    if (hasNoCompany) {
      navigate('/dashboard/company/subscription');
    }
  }, [hasNoCompany, navigate]);

  // Show subscription modal if company exists but no subscription
  useEffect(() => {
    if (hasCompanyButNoSubscription) {
      setShowSubscriptionModal(true);
    }
  }, [hasCompanyButNoSubscription]);

  return (
    <div className="space-y-6">
      <DashboardPageTitle title="Gestión de Empresa" />

      {error && !hasNoCompany && (
        <Alert color="failure" icon={AlertCircle}>
          <span className="font-medium">Error:</span>{' '}
          {error instanceof Error ? error.message : 'Error al cargar la información de la compañía'}
        </Alert>
      )}

      {isLoading ? (
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

          {/* Company Subscription Management */}
          <section>
            <Card>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Crown className="w-8 h-8 text-purple-500" />
                  <div>
                    <h3 className="text-lg font-semibold">Suscripción de Empresa</h3>
                    <p className="text-sm text-gray-600">Gestiona el plan de suscripción de tu empresa</p>
                  </div>
                </div>
                <Button
                  onClick={() => navigate('/dashboard/company/subscription')}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Gestionar Suscripción
                </Button>
              </div>
            </Card>
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

      {/* Subscription Required Modal */}
      {showSubscriptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="text-center">
              <Crown className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Suscripción Requerida</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Tu empresa necesita una suscripción activa para acceder a todas las funciones de gestión.
              </p>
              <div className="flex space-x-3">
                <Button
                  onClick={() => navigate('/dashboard')}
                  color="gray"
                  className="flex-1"
                >
                  Más tarde
                </Button>
                <Button
                  onClick={() => navigate('/dashboard/company/subscription')}
                  className="flex-1 bg-[#1B4965] hover:bg-[#153a52] text-white"
                >
                  Suscribirse
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

