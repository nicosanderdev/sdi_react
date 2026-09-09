import React, { useState, useEffect } from 'react';
import { Navbar, NavbarBrand, NavbarCollapse, NavbarLink, NavbarToggle } from "flowbite-react";
import { LogOut } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const navbarTheme = {
  root: {
    base: "w-full bg-white px-2 py-2.5 sm:px-4 dark:bg-gray-900",
    rounded: {
      on: "",
      off: "",
    },
    bordered: {
      on: "border",
      off: "",
    },
    inner: {
      base: "mx-auto flex w-full max-w-screen-xl flex-wrap items-center justify-between",
      fluid: {
        on: "",
        off: "container",
      },
    },
  },
  link: {
    base: "block py-2 pl-3 pr-4 md:p-0",
    active: {
      on: "bg-green-700 text-white md:bg-transparent md:text-green-700 dark:text-white",
      off: "border-b border-gray-100 text-gray-900 hover:bg-gray-50 md:border-0 md:hover:bg-transparent md:hover:text-green-600 dark:border-gray-700 dark:text-white dark:hover:bg-gray-800 dark:hover:text-green-400 md:dark:hover:bg-transparent md:dark:hover:text-green-400",
    },
    disabled: {
      on: "text-gray-400 hover:cursor-not-allowed dark:text-gray-600",
      off: "",
    },
  },
  toggle: {
    base: "inline-flex items-center rounded-lg p-2 text-sm text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 md:hidden dark:text-gray-400 dark:hover:bg-gray-800 dark:focus:ring-gray-600",
    icon: "h-6 w-6 shrink-0",
    title: "sr-only",
  },
};

const navLinkClass =
  "text-gray-900 dark:text-white hover:text-green-600 dark:hover:text-green-400";

export function PublicHeader() {
  const { user: supabaseUser, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loggingOut, setLoggingOut] = useState(false);

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
  const path = location.pathname;

  const getUserNavigation = () => {
    if (loading) {
      return null;
    }

    if (showGuestMenu) {
      return (
        <>
          <NavbarLink href="/login" className={navLinkClass}>
            Iniciar Sesión
          </NavbarLink>
          <NavbarLink href="/register" className={navLinkClass}>
            Registrarse
          </NavbarLink>
        </>
      );
    }

    return (
      <>
        <NavbarLink href="/dashboard" className={navLinkClass}>
          Dashboard
        </NavbarLink>
        <NavbarLink
          href="#"
          onClick={handleLogout}
          className={`flex items-center space-x-1 ${navLinkClass}`}
        >
          <LogOut className="w-4 h-4" />
          <span>Cerrar Sesión</span>
        </NavbarLink>
      </>
    );
  };

  return (
    <header className="w-full bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
      <Navbar fluid theme={navbarTheme} className="w-full bg-white dark:bg-gray-900">
        <NavbarBrand href="/">
          <img
            src="/logo-en-cartelera.png"
            className="mr-3 h-8 sm:h-10 w-auto object-contain"
            alt="En cartelera"
          />
          <span className="self-center whitespace-nowrap text-xl font-semibold text-gray-900 dark:text-white">
            En cartelera
          </span>
        </NavbarBrand>
        <NavbarToggle />
        <NavbarCollapse>
          <NavbarLink href="/" active={path === '/'} className={navLinkClass}>
            Inicio
          </NavbarLink>
          <NavbarLink href="/about" active={path === '/about'} className={navLinkClass}>
            Sobre nosotros
          </NavbarLink>
          <NavbarLink href="/contact" active={path === '/contact'} className={navLinkClass}>
            Contacto
          </NavbarLink>
          <React.Fragment key={supabaseUser?.id ?? 'guest'}>
            {getUserNavigation()}
          </React.Fragment>
        </NavbarCollapse>
      </Navbar>
    </header>
  );
}
