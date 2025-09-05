import { Navbar, NavbarBrand, NavbarCollapse, NavbarLink, NavbarToggle } from "flowbite-react";

export function PublicHeader() {
  return (
    <>
      <header>
        <div className="grid grid-cols-12 w-full">
        <Navbar fluid rounded className="col-span-12 md:col-span-8 md:col-start-3">
          <NavbarBrand href="https://flowbite-react.com">
            <img src="/favicon.svg" className="mr-3 h-6 sm:h-9" alt="Flowbite React Logo" />
            <span className="self-center whitespace-nowrap text-xl font-semibold dark:text-white">Flowbite React</span>
          </NavbarBrand>
          <NavbarToggle />
          <NavbarCollapse>
            <NavbarLink href="#" active>
              Home
            </NavbarLink>
            <NavbarLink href="#">
              About
            </NavbarLink>
            <NavbarLink href="#">Services</NavbarLink>
            <NavbarLink href="/login">Login</NavbarLink>
            <NavbarLink href="/register">Register</NavbarLink>
          </NavbarCollapse>
        </Navbar>
      </div>
    </header>
    </>
  );


  {/* <header className="bg-[#FDFFFC] border-b border-gray-200">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <a href="/" className="text-2xl font-bold text-[#1B4965]">
              InmoGestión
            </a>
          </div>
          {/* Desktop menu
          <div className="hidden md:flex items-center space-x-8">
            <a href="/features" className="text-[#101828] hover:text-[#1B4965]">
              Características
            </a>
            <a href="/pricing" className="text-[#101828] hover:text-[#1B4965]">
              Precios
            </a>
            <a href="/contact" className="text-[#101828] hover:text-[#1B4965]">
              Contacto
            </a>
            <a href="/login" className="text-[#1B4965] hover:text-[#62B6CB]">
              Iniciar sesión
            </a>
            <a href="/register" className="bg-[#62B6CB] text-[#FDFFFC] px-4 py-2 rounded-md hover:opacity-90 transition-colors">
              Registrarse
            </a>
          </div>
          {/* Mobile menu button 
          <div className="md:hidden flex items-center">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-[#101828] p-2">
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
        {/* Mobile menu 
        {isMenuOpen && <div className="md:hidden py-4">
            <div className="flex flex-col space-y-4">
              <a href="/features" className="text-[#101828] hover:text-[#1B4965]">
                Características
              </a>
              <a href="/pricing" className="text-[#101828] hover:text-[#1B4965]">
                Precios
              </a>
              <a href="/contact" className="text-[#101828] hover:text-[#1B4965]">
                Contacto
              </a>
              <a href="/login" className="text-[#1B4965] hover:text-[#62B6CB]">
                Iniciar sesión
              </a>
              <a href="/register" className="bg-[#62B6CB] text-[#FDFFFC] px-4 py-2 rounded-md hover:opacity-90 transition-colors inline-block text-center">
                Registrarse
              </a>
            </div>
          </div>}
      </nav>
    </header>; */}
}