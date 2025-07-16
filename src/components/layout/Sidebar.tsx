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

export function Sidebar() {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <HomeIcon size={20} />, path: '/dashboard' },
    { id: 'profile', label: 'Mi Perfil', icon: <UserIcon size={20} />, path: '/dashboard/profile' },
    { id: 'properties', label: 'Propiedades', icon: <BuildingIcon size={20} />, path: '/dashboard/properties' },
    { id: 'messages', label: 'Mensajes', icon: <MessageSquareIcon size={20} />, path: '/dashboard/messages' },
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
                    `flex items-center w-full px-6 py-3 text-left hover:bg-[#47A9C2] transition-colors ${
                      isActive ? 'bg-[#62B6CB]' : ''
                    }`
                  }
                  end // ← important for exact match on base route
                >
                  <span className="mr-3">{item.icon}</span>
                  <span>{item.label}</span>
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