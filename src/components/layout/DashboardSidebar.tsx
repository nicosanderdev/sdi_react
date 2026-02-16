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
import { AdminNavigation } from './AdminNavigation';
import authService from '../../services/AuthService';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, fetchMessageCounts, RootState } from '../../store';
import { Button, Modal, ModalBody, ModalHeader, Sidebar, SidebarItem, SidebarItemGroup, SidebarItems, SidebarLogo } from 'flowbite-react';
import { hasRole } from '../../utils/RoleUtils';
import { Roles } from '../../models/Roles';

// Custom sidebar theme to match the green app theme
const customSidebarTheme = {
  root: {
    base: "h-full",
    collapsed: {
      on: "w-16",
      off: "w-64"
    },
    inner: "h-full overflow-y-auto overflow-x-hidden bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 shadow-sm"
  },
  item: {
    base: "flex items-center justify-center rounded-lg p-2 text-base font-normal text-gray-900 dark:text-white hover:bg-green-50 dark:hover:bg-green-900/20",
    active: "bg-green-50 dark:bg-green-900 text-green-700 dark:text-white",
    collapsed: {
      insideCollapse: "group w-full pl-8 transition-[width] ease-in-out duration-300",
      noIcon: "font-bold"
    },
    content: {
      base: "px-3 flex-1 whitespace-nowrap text-sm"
    },
    icon: {
      base: "h-6 w-6 flex-shrink-0 text-gray-500 dark:text-gray-400 transition duration-75 group-hover:text-gray-900 dark:group-hover:text-white",
      active: "text-green-700 dark:text-green-400"
    },
    label: "ml-3 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-300"
  },
  itemGroup: {
    base: "mt-4 space-y-2 border-t border-gray-200 dark:border-gray-700 pt-4 first:mt-0 first:border-t-0 first:pt-0"
  },
  logo: {
    base: "mb-5 flex items-center pl-2.5",
    collapsed: {
      on: "hidden",
      off: "self-center whitespace-nowrap text-sm font-semibold dark:text-white"
    },
    img: "mr-3 h-6 w-6 self-center rounded-full border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800"
  }
};

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
    { id: 'dashboard', label: 'Panel', icon: HomeIcon, path: '/dashboard' },
    { id: 'properties', label: 'Propiedades', icon: BuildingIcon, path: '/dashboard/properties' },
    { id: 'messages', label: 'Mensajes', icon: MessageSquareIcon, path: '/dashboard/messages', badgeCount: counts?.inbox && counts.inbox > 0 ? counts.inbox : undefined },
    { id: 'reports', label: 'Reportes', icon: BarChartIcon, path: '/dashboard/reports' },
    { id: 'profile', label: 'Mi Perfil', icon: UserIcon, path: '/dashboard/profile' },
    { id: 'company', label: 'Empresa', icon: BoxesIcon, path: '/dashboard/company' },
    { id: 'subscription', label: 'Suscripción', icon: Crown, path: '/dashboard/subscription' }

  ];

  // Admin gets profile and messages items in addition to admin navigation
  const adminPersonalItems = navItems.filter(item => item.id === 'profile' || item.id === 'messages');


  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  return (
    <>
      <Sidebar aria-label="Sidebar with logo branding example" theme={customSidebarTheme} className="bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 shadow-sm">
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
          {isAdmin ? (
            // Admin navigation with personal items
            <SidebarItemGroup>
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Administración
              </div>
              {adminPersonalItems.map(item => (
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
              <AdminNavigation />
            </SidebarItemGroup>
          ) : (
            // Regular user navigation only
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