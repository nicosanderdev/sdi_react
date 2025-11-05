import { Navbar, NavbarBrand, NavbarCollapse, NavbarLink, NavbarToggle } from "flowbite-react";
import { CustomDarkThemeToggle } from "../ui/CustomDarkThemeToggle";
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { isManager, isPublicUser } from '../../utils/RoleUtils';
import { User, LogOut } from 'lucide-react';
import authService from '../../services/AuthService';
import { useNavigate } from 'react-router-dom';

export function PublicHeader() {
  const user = useSelector((state: RootState) => state.user.profile);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await authService.logout();
    navigate('/');
  };

  const getUserNavigation = () => {
    if (!user) {
      return (
        <>
          <NavbarLink href="/login">Iniciar Sesión</NavbarLink>
          <NavbarLink href="/register">Registrarse</NavbarLink>
        </>
      );
    }

    if (isManager(user)) {
      return (
        <>
          <NavbarLink href="/dashboard">Dashboard</NavbarLink>
          <NavbarLink href="/dashboard/properties">Propiedades</NavbarLink>
          <NavbarLink href="/dashboard/messages">Mensajes</NavbarLink>
          <NavbarLink href="/dashboard/profile">Mi Perfil</NavbarLink>
          <NavbarLink href="#" onClick={handleLogout} className="flex items-center space-x-1">
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </NavbarLink>
        </>
      );
    }

    if (isPublicUser(user)) {
      return (
        <>
          <NavbarLink href="/welcome">Mi Panel</NavbarLink>
          <NavbarLink href="/properties">Propiedades</NavbarLink>
          <NavbarLink href="/messages">Mensajes</NavbarLink>
          <NavbarLink href="/profile">Mi Perfil</NavbarLink>
          <NavbarLink href="/upgrade" className="text-yellow-600 hover:text-yellow-700">
            Actualizar a Manager
          </NavbarLink>
          <NavbarLink href="#" onClick={handleLogout} className="flex items-center space-x-1">
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </NavbarLink>
        </>
      );
    }

    return null;
  };

  return (
    <>
      <header>
        <div className="grid grid-cols-12 w-full">
        <Navbar fluid rounded className="col-span-12 md:col-span-8 md:col-start-3">
          <NavbarBrand href="/">
            <img src="/favicon.svg" className="mr-3 h-6 sm:h-9" alt="SGI Logo" />
            <span className="self-center whitespace-nowrap text-xl font-semibold dark:text-white">SGI</span>
          </NavbarBrand>
          <NavbarToggle />
          <CustomDarkThemeToggle className="mr-3" />
          <NavbarCollapse>
            <NavbarLink href="/" active>Inicio</NavbarLink>
            <NavbarLink href="/properties">Propiedades</NavbarLink>
            <NavbarLink href="/contact">Contacto</NavbarLink>
            {getUserNavigation()}
          </NavbarCollapse>
        </Navbar>
      </div>
    </header>
    </>
  );
}