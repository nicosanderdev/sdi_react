import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Spinner, Alert, Button, Card } from 'flowbite-react';
import { AlertCircle, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import DashboardPageTitle from '../../../components/dashboard/DashboardPageTitle';
import { CompanyInfoCard } from '../../../components/company/CompanyInfoCard';
import { CompanyUsersList } from '../../../components/company/CompanyUsersList';
import { CompanyProfileEditor } from '../../../components/company/CompanyProfileEditor';
import companyService from '../../../services/CompanyService';
import subscriptionService from '../../../services/SubscriptionService';
import propertyService from '../../../services/PropertyService';
import messageService from '../../../services/MessageService';
import reportService from '../../../services/ReportService';
import { selectUserCompanies, selectHasCompanies, selectUserProfile } from '../../../store/slices/userSlice';
import { CompanyRoles } from '../../../models/CompanyRoles';

export function CompanyManagementPage() {
  const navigate = useNavigate();

  const userCompanies = useSelector(selectUserCompanies);
  const hasCompanies = useSelector(selectHasCompanies);
  const userProfile = useSelector(selectUserProfile);

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>(undefined);

  // Fetch company info
  const {
    data: companyInfo,
    isLoading: isLoadingCompanyInfo,
    error: companyInfoError,
    refetch: refetchCompanyInfo,
  } = useQuery({
    queryKey: ['companyInfo', selectedCompanyId],
    queryFn: async () => {
      const [info, subscription, propertiesData, messageCounts, totalsData] = await Promise.all([
        (selectedCompanyId
          ? companyService.getCompanyInfo(selectedCompanyId)
          : companyService.getCompanyInfo()
        ).catch(() => null),
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
    queryKey: ['companyUsers', selectedCompanyId],
    queryFn: () => companyService.getCompanyUsers(selectedCompanyId),
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

  useEffect(() => {
    if (!hasCompanies) {
      setSelectedCompanyId(undefined);
      return;
    }

    if (!selectedCompanyId) {
      if (companyInfo?.id) {
        setSelectedCompanyId(companyInfo.id);
      } else if (userCompanies.length > 0) {
        setSelectedCompanyId(userCompanies[0].id);
      }
    }
  }, [hasCompanies, companyInfo?.id, userCompanies, selectedCompanyId]);

  // Redirect to company subscription flow if no company
  useEffect(() => {
    if (hasNoCompany) {
      navigate('/dashboard/company/subscription');
    }
  }, [hasNoCompany, navigate]);

  const selectedCompany =
    selectedCompanyId && userCompanies
      ? userCompanies.find((c) => c.id === selectedCompanyId)
      : null;

  const isGlobalAdmin = userProfile?.roles?.includes(CompanyRoles.Admin) ?? false;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold">Gestión de empresa</h1>
        <div className="flex flex-col items-start md:items-end gap-2">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {hasCompanies && selectedCompany ? (
              isGlobalAdmin ? (
                <>
                  Estás gestionando la empresa:{' '}
                  <span className="font-semibold">{selectedCompany.name}</span> (Administrador)
                </>
              ) : (
                <>
                  Estás viendo la empresa:{' '}
                  <span className="font-semibold">{selectedCompany.name}</span> (sin permisos de administración)
                </>
              )
            ) : (
              'No perteneces a ninguna empresa.'
            )}
          </p>
          {hasCompanies && userCompanies.length > 1 && (
            <div className="w-full md:w-64">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                Empresa actual
              </label>
              <select
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white dark:bg-gray-800 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={selectedCompanyId || userCompanies[0]?.id || ''}
                onChange={(e) => setSelectedCompanyId(e.target.value || undefined)}
              >
                {userCompanies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {hasCompanyButNoSubscription ? (
        /* Subscription Required Card */
        <Card className="max-w-2xl mx-auto">
          <div className="text-center py-8">
            <Crown className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Suscripción Requerida</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Tu empresa necesita una suscripción activa para acceder a todas las funciones de gestión.
            </p>
            <div className="flex space-x-3 justify-center">
              <Button
                onClick={() => navigate('/dashboard')}
                color="alternative"
                className="flex-1 max-w-xs"
              >
                Más tarde
              </Button>
              <Button
                onClick={() => navigate('/dashboard/company/subscription')}
                color="green"
                className="flex-1 max-w-xs"
              >
                Suscribirse
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
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
                    {isGlobalAdmin && (
                      <Button
                        onClick={() => navigate('/dashboard/company/subscription')}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        Gestionar Suscripción
                      </Button>
                    )}
                  </div>
                </Card>
              </section>

              {/* Company Profile Editor */}
              {isGlobalAdmin ? (
                <section>
                  <CompanyProfileEditor
                    companyInfo={enhancedCompanyInfo}
                    isLoading={isLoadingCompanyInfo}
                    onUpdate={handleRefresh}
                  />
                </section>
              ) : null}

              {/* Company Users Management */}
              {isGlobalAdmin ? (
                <section>
                  <CompanyUsersList
                    users={companyUsers}
                    isLoading={isLoadingUsers}
                    error={usersError ? (usersError instanceof Error ? usersError.message : 'Error desconocido') : null}
                    onRefresh={handleRefresh}
                  />
                </section>
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  );
}

