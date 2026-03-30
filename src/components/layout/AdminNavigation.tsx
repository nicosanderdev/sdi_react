import { useNavigate, useLocation } from 'react-router-dom';
import { SidebarItem } from 'flowbite-react';
import {
  UserIcon,
  BuildingIcon,
  BarChartIcon,
  FileText,
  CalendarCheck,
  Receipt,
  type LucideIcon
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
}

/**
 * Admin-specific navigation component
 * Contains all admin navigation items as specified in the requirements
 */
export function AdminNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const adminNavItems: NavItem[] = [
    { id: 'admin-dashboard', label: 'Dashboard global', icon: BarChartIcon, path: '/dashboard/admin/dashboard' },
    { id: 'admin-properties', label: 'Propiedades', icon: BuildingIcon, path: '/dashboard/admin/properties' },
    { id: 'admin-bookings', label: 'Reservas', icon: CalendarCheck, path: '/dashboard/admin/bookings' },
    { id: 'admin-payments', label: 'Gestión de pagos', icon: Receipt, path: '/dashboard/admin/payments' },
    { id: 'admin-users', label: 'Usuarios', icon: UserIcon, path: '/dashboard/admin/users' },
    { id: 'admin-logs', label: 'Logs', icon: FileText, path: '/dashboard/admin/logs' }
    // { id: 'admin-config', label: 'Configuración', icon: SettingsIcon, path: '/dashboard/admin/config' },
  ];

  return (
    <>
      {adminNavItems.map(item => (
        <SidebarItem
          key={item.id}
          onClick={() => navigate(item.path)}
          icon={item.icon}
          active={location.pathname === item.path || location.pathname.startsWith(item.path)}
          className="hover:bg-green-50 dark:hover:bg-green-900/20"
          style={{
            backgroundColor: (location.pathname === item.path || location.pathname.startsWith(item.path))
              ? 'rgb(240 253 244)'
              : undefined
          }}
        >
          {item.label}
        </SidebarItem>
      ))}
    </>
  );
}
