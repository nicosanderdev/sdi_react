import { Card, TabItem, Tabs } from 'flowbite-react';
import DashboardPageTitle from '../../../components/dashboard/DashboardPageTitle';
import { AppParametersManager } from '../../../components/admin/config/AppParametersManager';
import { PlansManager } from '../../../components/admin/config/PlansManager';

export function AdminConfigPage() {
  return (
    <div className="space-y-6">
      <DashboardPageTitle title="Configuración" />
      <Card>
        <Tabs>
          <TabItem active title="Parámetros de precio">
            <AppParametersManager />
          </TabItem>
          <TabItem title="Planes">
            <PlansManager />
          </TabItem>
        </Tabs>
      </Card>
    </div>
  );
}
