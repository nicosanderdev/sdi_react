import { Navbar, NavbarBrand, NavbarCollapse, NavbarLink, NavbarToggle } from "flowbite-react";
import { CustomDarkThemeToggle } from "../ui/CustomDarkThemeToggle";

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
          <CustomDarkThemeToggle className="mr-3" />
          <NavbarCollapse>
            <NavbarLink href="/" active>Home</NavbarLink>
            {/* <NavbarLink href="#">About</NavbarLink>
            <NavbarLink href="#">Services</NavbarLink> */}
            <NavbarLink href="/login">Login</NavbarLink>
            <NavbarLink href="/register">Register</NavbarLink>
          </NavbarCollapse>
        </Navbar>
      </div>
    </header>
    </>
  );
}