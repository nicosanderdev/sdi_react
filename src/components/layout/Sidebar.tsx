import { NavLink, useNavigate } from 'react-router-dom';
import {
  HomeIcon,
  UserIcon,
  BuildingIcon,
  MessageSquareIcon,
  BarChartIcon,
  SettingsIcon,
  LogOutIcon
} from 'lucide-react';
import authService from '../../services/AuthService';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, fetchMessageCounts, RootState } from '../../store';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  badgeCount?: number;
}
export function Sidebar() {

  const dispatch = useDispatch<AppDispatch>();
  const { counts, status } = useSelector((state: RootState) => state.notifications);  
  useEffect(() => {
    // We only fetch if the data hasn't been fetched yet
    if (status === 'idle') {
      dispatch(fetchMessageCounts());
    }
  }, [status, dispatch]);
  
  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <HomeIcon size={20} />, path: '/dashboard' },
    { id: 'profile', label: 'Mi Perfil', icon: <UserIcon size={20} />, path: '/dashboard/profile' },
    { id: 'properties', label: 'Propiedades', icon: <BuildingIcon size={20} />, path: '/dashboard/properties' },
    { id: 'messages', label: 'Mensajes', icon: <MessageSquareIcon size={20} />, path: '/dashboard/messages', badgeCount: counts?.unread ?? 0 },
    { id: 'reports', label: 'Reportes', icon: <BarChartIcon size={20} />, path: '/dashboard/reports' }
  ];
  const navigate = useNavigate();
  
  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <div className="w-64 bg-[#1B4965] text-[#FDFFFC] flex flex-col">
      <div className="p-4 flex items-center justify-center border-b border-[#62B6CB]">
        <h1 className="text-xl font-bold">InmoGestión</h1>
      </div>
      <div className="flex-1 py-6">
        <nav>
          <ul>
            {navItems.map(item => (
              <li key={item.id} className="mb-1">
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center w-full px-6 py-3 text-left hover:bg-[#47A9C2] transition-colors ${isActive ? 'bg-[#62B6CB]' : ''
                    }`
                  }
                  end // ← important for exact match on base route
                >
                  <span className="mr-3">{item.icon}</span>
                  <span className="flex-grow">{item.label}</span>
                  {item.badgeCount && item.badgeCount > -1 && (
                    <span style={{
                      background: 'red',
                      color: 'white',
                      borderRadius: '50%',
                      padding: '2px 6px',
                      fontSize: '12px',
                      marginLeft: 'auto'
                    }}>
                      {item.badgeCount}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="p-4 border-t border-[#62B6CB]">
        <NavLink
          to="/dashboard/settings"
          className={({ isActive }) =>
            `flex items-center w-full px-6 py-3 text-left hover:bg-[#62B6CB] transition-colors ${
              isActive ? 'bg-[#62B6CB]' : ''
            }`
          }
        >
          <span className="mr-3">
            <SettingsIcon size={20} />
          </span>
          <span>Configuración</span>
        </NavLink>

        <button
          className="flex items-center w-full px-6 py-3 text-left hover:bg-[#62B6CB] transition-colors"
          onClick={handleLogout}
        >
          <span className="mr-3">
            <LogOutIcon size={20} />
          </span>
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </div>
  );
}