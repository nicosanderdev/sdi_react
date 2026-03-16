import React, { useState, useEffect } from 'react';
import { Navbar, NavbarBrand, NavbarCollapse, NavbarLink, NavbarToggle } from "flowbite-react";
import { CustomDarkThemeToggle } from "../ui/CustomDarkThemeToggle";
import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function PublicHeader() {
  const { user: supabaseUser, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!supabaseUser) setLoggingOut(false);
  }, [supabaseUser]);

  useEffect(() => {
    if (!supabaseUser) setLoggingOut(false);
  }, [supabaseUser]);

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoggingOut(true);
    await logout();
    navigate('/', { replace: true });
  };

  const showGuestMenu = loggingOut || !supabaseUser;

  const getUserNavigation = () => {
    // While auth state is loading, avoid flashing incorrect buttons
    if (loading) {
      return null;
    }

    if (showGuestMenu) {
      return (
        <>
          <NavbarLink href="/login">Iniciar Sesión</NavbarLink>
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
            <React.Fragment key={supabaseUser?.id ?? 'guest'}>
              {getUserNavigation()}
            </React.Fragment>
          </NavbarCollapse>
        </Navbar>
      </div>
    </header>
    </>
  );
}