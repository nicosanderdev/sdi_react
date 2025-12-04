import { useNavigate, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  UserIcon,
  BuildingIcon,
  MessageSquareIcon,
  BarChartIcon,
  SettingsIcon,
  LogOutIcon,
  TriangleAlert,
  Heart as HeartIcon,
  Crown,
  Shield,
  FileText,
  BoxesIcon,
  type LucideIcon
} from 'lucide-react';
import authService from '../../services/AuthService';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, fetchMessageCounts, RootState } from '../../store';
import { Button, Modal, ModalBody, ModalHeader, Sidebar, SidebarItem, SidebarItemGroup, SidebarItems, SidebarLogo } from 'flowbite-react';
import { hasRole } from '../../utils/RoleUtils';
import { Roles } from '../../models/Roles';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  badgeCount?: number;
}

export function DashboardSidebar() {
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const dispatch = useDispatch<AppDispatch>();
  const { counts, status } = useSelector((state: RootState) => state.notifications);
  const user = useSelector((state: RootState) => state.user.profile);
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user ? hasRole(user, Roles.Admin) : false;

  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchMessageCounts());
    }
  }, [status, dispatch]);

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: HomeIcon, path: '/dashboard' },
    { id: 'properties', label: 'Propiedades', icon: BuildingIcon, path: '/dashboard/properties' },
    { id: 'favorites', label: 'Favoritos', icon: HeartIcon, path: '/dashboard/favorites' },
    { id: 'messages', label: 'Mensajes', icon: MessageSquareIcon, path: '/dashboard/messages', badgeCount: counts?.unread ?? 3 },
    { id: 'reports', label: 'Reportes', icon: BarChartIcon, path: '/dashboard/reports' },
    { id: 'profile', label: 'Mi Perfil', icon: UserIcon, path: '/dashboard/profile' },
    { id: 'company', label: 'Empresa', icon: BoxesIcon, path: '/dashboard/company' },
    { id: 'subscription', label: 'Suscripción', icon: Crown, path: '/dashboard/subscription' }
    
  ];

  const adminNavItems: NavItem[] = [
    { id: 'admin-subscriptions', label: 'Suscripciones', icon: Shield, path: '/dashboard/admin/subscriptions' },
    { id: 'admin-invoices', label: 'Facturas', icon: FileText, path: '/dashboard/admin/invoices' },
  ];

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  return (
    <>
      <Sidebar aria-label="Sidebar with logo branding example" className="bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 shadow-sm">
        <SidebarLogo
          href="/dashboard"
          onClick={(e) => {
            e.preventDefault();
            navigate('/dashboard');
          }}
          img="/favicon.svg"
          imgAlt="SGI logo"
        >
          SGI
        </SidebarLogo>
        <SidebarItems>
          <SidebarItemGroup>
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Menú
            </div>
            {navItems.map(item => (
              <SidebarItem
                key={item.id}
                onClick={() => navigate(item.path)}
                icon={item.icon}
                label={item.badgeCount !== undefined ? String(item.badgeCount) : undefined}
                active={item.path === location.pathname || (item.path !== '/dashboard' && location.pathname.startsWith(item.path))}
                className="hover:bg-green-50 dark:hover:bg-green-900/20"
                style={{
                  backgroundColor: (item.path === location.pathname || (item.path !== '/dashboard' && location.pathname.startsWith(item.path)))
                    ? 'rgb(240 253 244)'
                    : undefined
                }}
              >
                {item.label}
              </SidebarItem>
            ))}
          </SidebarItemGroup>
          {isAdmin && (
            <SidebarItemGroup>
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Administración
              </div>
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
            </SidebarItemGroup>
          )}
          <SidebarItemGroup>
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              General
            </div>
            <SidebarItem
              onClick={() => navigate('/dashboard/settings')}
              icon={SettingsIcon}
              className="hover:bg-green-50 dark:hover:bg-green-900/20"
              active={location.pathname === '/dashboard/settings'}
              style={{
                backgroundColor: location.pathname === '/dashboard/settings'
                  ? 'rgb(240 253 244)'
                  : undefined
              }}
            >
              Configuración
            </SidebarItem>
            <SidebarItem
              icon={LogOutIcon}
              onClick={() => setIsLogoutModalOpen(true)}
              className="hover:bg-green-50 dark:hover:bg-green-900/20"
            >
              Cerrar Sesión
            </SidebarItem>
          </SidebarItemGroup>
        </SidebarItems>
      </Sidebar>

      <Modal show={isLogoutModalOpen} size="md" onClose={() => setIsLogoutModalOpen(false)} popup>
        <ModalHeader />
        <ModalBody>
          <div className="text-center">
            <TriangleAlert className="mx-auto mb-4 h-14 w-14 dark:text-gray-300" />
            <h3 className="mb-5 text-lg dark:text-gray-300">
              ¿Seguro que quieres cerrar sesión?
            </h3>
            <div className="flex justify-center gap-4">
              <Button color="red" onClick={() => {
                setIsLogoutModalOpen(false),
                handleLogout()
              }}>
                Si, estoy seguro
              </Button>
              <Button color="alternative" onClick={() => setIsLogoutModalOpen(false)}>
                No, cancelar
              </Button>
            </div>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
}