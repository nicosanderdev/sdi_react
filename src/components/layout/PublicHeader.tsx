import { Navbar, NavbarBrand, NavbarCollapse, NavbarLink, NavbarToggle } from "flowbite-react";
import { CustomDarkThemeToggle } from "../ui/CustomDarkThemeToggle";
import { LogOut } from 'lucide-react';
import authService from '../../services/AuthService';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function PublicHeader() {
  const { user: supabaseUser, loading } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await authService.logout();
    navigate('/');
  };

  const getUserNavigation = () => {
    // While auth state is loading, avoid flashing incorrect buttons
    if (loading) {
      return null;
    }

    if (!supabaseUser) {
      return (
        <>
          <NavbarLink href="/login">Iniciar Sesión</NavbarLink>
          <NavbarLink href="/register">Registrarse</NavbarLink>
        </>
      );
    }

    return (
      <>
        <NavbarLink href="/dashboard" className="text-gray-900 dark:text-white hover:text-green-600 dark:hover:text-green-400">Dashboard</NavbarLink>
        <NavbarLink href="#" onClick={handleLogout} className="flex items-center space-x-1 text-gray-900 dark:text-white hover:text-green-600 dark:hover:text-green-400">
          <LogOut className="w-4 h-4" />
          <span>Cerrar Sesión</span>
        </NavbarLink>
      </>
    );
  };

  return (
    <>
      <header>
        <div className="grid grid-cols-12 w-full">
        <Navbar fluid rounded className="col-span-12 md:col-span-8 md:col-start-3">
          <NavbarBrand href="/">
            <img src="/favicon.svg" className="mr-3 h-6 sm:h-9" alt="SGI Logo" />
            <span className="self-center whitespace-nowrap text-xl font-semibold text-gray-900 dark:text-white">SGI</span>
          </NavbarBrand>
          <NavbarToggle />
          <CustomDarkThemeToggle className="mr-3" />
          <NavbarCollapse>
            <NavbarLink href="/" active className="text-gray-900 dark:text-white hover:text-green-600 dark:hover:text-green-400">Inicio</NavbarLink>
            <NavbarLink href="/contact" className="text-gray-900 dark:text-white hover:text-green-600 dark:hover:text-green-400">Contacto</NavbarLink>
            {getUserNavigation()}
          </NavbarCollapse>
        </Navbar>
      </div>
    </header>
    </>
  );
}