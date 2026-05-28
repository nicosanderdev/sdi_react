import DashboardPageTitle from '../../../components/dashboard/DashboardPageTitle';
import { AppParametersManager } from '../../../components/admin/config/AppParametersManager';

export function AdminConfigPage() {
  return (
    <div className="space-y-6">
      <DashboardPageTitle title="Configuración" />
      <AppParametersManager />
    </div>
  );
}
