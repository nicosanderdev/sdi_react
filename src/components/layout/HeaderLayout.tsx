import { useSelector } from 'react-redux';
import { selectUserProfile } from '../../store/slices/userSlice';
import { Avatar, Dropdown, DropdownDivider, DropdownHeader, DropdownItem, Navbar } from 'flowbite-react';
import { CustomDarkThemeToggle } from '../ui/CustomDarkThemeToggle';
import { useNavigate } from 'react-router-dom';
import authService from '../../services/AuthService';

export function HeaderLayout() {
  const userProfile = useSelector(selectUserProfile);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  const navbarTheme = {
    "root": {
      "base": "bg-gray-50 px-2 py-2.5 sm:px-4 dark:border-gray-700 dark:bg-gray-800",
      "rounded": {
        "on": "",
        "off": ""
      },
      "bordered": {
        "on": "border",
        "off": ""
      },
      "inner": {
        "base": "flex flex-wrap items-center justify-end w-full",
        "fluid": {
          "on": "",
          "off": "container"
        }
      }
    },
    "brand": {
      "base": "flex items-center"
    },
    "collapse": {
      "base": "w-full md:block md:w-auto",
      "list": "mt-4 flex flex-col md:mt-0 md:flex-row md:space-x-8 md:text-sm md:font-medium",
      "hidden": {
        "on": "hidden",
        "off": ""
      }
    },
    "link": {
      "base": "block py-2 pl-3 pr-4 md:p-0",
      "active": {
        "on": "bg-primary-700 text-white md:bg-transparent md:text-primary-700 dark:text-white",
        "off": "border-b border-gray-100 text-gray-700 hover:bg-gray-50 md:border-0 md:hover:bg-transparent md:hover:text-primary-700 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white md:dark:hover:bg-transparent md:dark:hover:text-white"
      },
      "disabled": {
        "on": "text-gray-400 hover:cursor-not-allowed dark:text-gray-600",
        "off": ""
      }
    },
    "toggle": {
      "base": "inline-flex items-center rounded-lg p-2 text-sm text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 md:hidden dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600",
      "icon": "h-6 w-6 shrink-0",
      "title": "sr-only"
    }
  }

  return (
    <>
      <Navbar fluid rounded theme={navbarTheme} className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center w-full justify-end">
          {/* Search Bar 
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar..."
              className="block w-64 pl-10 pr-3 py-2 text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-green-500 focus:border-green-500 dark:focus:ring-green-400 dark:focus:border-green-400"
            />
          </div> */}

          {/* Right side - Dark mode toggle and User menu */}
          <div className="flex items-center">
            <CustomDarkThemeToggle />
            <div className="ml-4">
              <Dropdown
                arrowIcon={false}
                inline
                label={
                <div className="flex items-center space-x-3 w-56">
                  {userProfile?.avatarUrl ? (
                    <Avatar
                      alt="User settings"
                      img={userProfile.avatarUrl}
                      rounded
                      theme={{ root: { img: { base: "rounded object-cover" } } }}
                    />
                  ) : (
                    <div
                      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white font-semibold text-sm"
                      aria-label="User avatar"
                    >
                      {[userProfile?.firstName, userProfile?.lastName]
                        .filter(Boolean)
                        .map((n) => n!.charAt(0))
                        .join('')
                        .toUpperCase()
                        .slice(0, 2) || 'U'}
                    </div>
                  )}
                  <div className="hidden md:block text-left">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {userProfile?.firstName || 'Usuario'} {userProfile?.lastName || ''}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {userProfile?.email || 'usuario@email.com'}
                    </div>
                  </div>
                </div>
              }
            >
              <DropdownHeader>
                <span className="block text-sm font-medium">
                  {userProfile?.firstName || 'Usuario'} {userProfile?.lastName || ''}
                </span>
                <span className="block truncate text-sm font-medium text-gray-500 dark:text-gray-400">
                  {userProfile?.email || 'usuario@email.com'}
                </span>
                </DropdownHeader>
                <DropdownItem onClick={() => navigate('/dashboard/profile')}>Perfil</DropdownItem>
                <DropdownItem onClick={() => navigate('/dashboard/settings')}>Configuración</DropdownItem>
                <DropdownDivider />
                <DropdownItem onClick={handleLogout}>Cerrar Sesión</DropdownItem>
              </Dropdown>
            </div>
          </div>
        </div>
      </Navbar>
    </>
  );
}