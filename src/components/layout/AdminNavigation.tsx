import { useNavigate, useLocation } from 'react-router-dom';
import { SidebarItem } from 'flowbite-react';
import {
  HomeIcon,
  UserIcon,
  BuildingIcon,
  MessageSquareIcon,
  BarChartIcon,
  SettingsIcon,
  Crown,
  Shield,
  FileText,
  BoxesIcon,
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
    { id: 'admin-users', label: 'Usuarios', icon: UserIcon, path: '/dashboard/admin/users' },
    { id: 'admin-subscriptions', label: 'Suscripciones', icon: Crown, path: '/dashboard/admin/subscriptions' },
    { id: 'admin-properties', label: 'Propiedades', icon: BuildingIcon, path: '/dashboard/admin/properties' },
    { id: 'admin-config', label: 'Configuración', icon: SettingsIcon, path: '/dashboard/admin/config' },
    { id: 'admin-logs', label: 'Logs', icon: FileText, path: '/dashboard/admin/logs' },
    { id: 'admin-support', label: 'Soporte', icon: MessageSquareIcon, path: '/dashboard/admin/support' },
    { id: 'admin-tools', label: 'Herramientas', icon: BoxesIcon, path: '/dashboard/admin/tools' },
    { id: 'admin-security', label: 'Seguridad', icon: Shield, path: '/dashboard/admin/security' },
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
