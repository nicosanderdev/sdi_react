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
// Import useState to manage the modal's visibility
import { useEffect, useState } from 'react';
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
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const dispatch = useDispatch<AppDispatch>();
  const { counts, status } = useSelector((state: RootState) => state.notifications);

  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchMessageCounts());
    }
  }, [status, dispatch]);

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <HomeIcon size={20} />, path: '/dashboard' },
    { id: 'properties', label: 'Propiedades', icon: <BuildingIcon size={20} />, path: '/dashboard/properties' },
    { id: 'messages', label: 'Mensajes', icon: <MessageSquareIcon size={20} />, path: '/dashboard/messages', badgeCount: counts?.unread ?? 0 },
    { id: 'reports', label: 'Reportes', icon: <BarChartIcon size={20} />, path: '/dashboard/reports' },
    { id: 'profile', label: 'Mi Perfil', icon: <UserIcon size={20} />, path: '/dashboard/profile' },
  ];
  const navigate = useNavigate();

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  return (
    <>
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
                    end
                  >
                    <span className="mr-3">{item.icon}</span>
                    <span className="flex-grow">{item.label}</span>
                    {item.badgeCount && item.badgeCount > 0 && ( // Changed to > 0
                      <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center ml-auto">
                        {item.badgeCount}
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="py-4 border-t border-[#62B6CB]">
          <NavLink
            to="/dashboard/settings"
            className={({ isActive }) =>
              `flex items-center w-full px-6 py-3 text-left hover:bg-[#62B6CB] transition-colors ${isActive ? 'bg-[#62B6CB]' : ''
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
            onClick={() => setIsLogoutModalOpen(true)}
          >
            <span className="mr-3">
              <LogOutIcon size={20} />
            </span>
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* --- START: Logout Confirmation Modal --- */}
      {isLogoutModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
          onClick={() => setIsLogoutModalOpen(false)} // Close modal on overlay click
        >
          <div
            className="bg-white text-[#1B4965] p-8 rounded-lg shadow-xl w-full max-w-md border-2 border-[#62B6CB]"
            onClick={e => e.stopPropagation()} // Prevent closing when clicking inside the modal
          >
            <h2 className="text-xl font-semibold mb-4 text-center">
              Cerrar sesión
            </h2>
            <p className="text-center mb-6">
              ¿Estás seguro de que quieres salir?
            </p>
            <div className="flex justify-center gap-4">
              <button
                className="px-6 py-2 rounded-md bg-white border-2 border-[#62B6CB] hover:bg-gray-100 text-[#62B6CB] font-semibold transition-colors"
                onClick={() => setIsLogoutModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="px-6 py-2 rounded-md bg-[#62B6CB] hover:bg-[#47A9C2] text-white font-bold transition-colors"
                onClick={handleLogout}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}