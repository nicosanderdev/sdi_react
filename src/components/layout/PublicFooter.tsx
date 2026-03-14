import React from 'react';
import {
  Footer,
  FooterBrand,
  FooterCopyright,
  FooterDivider,
  FooterIcon,
  FooterLink,
  FooterLinkGroup,
  FooterTitle,
} from "flowbite-react";
import { 
  Facebook, 
  Instagram, 
  Twitter, 
  Github, 
  Dribbble 
} from "lucide-react";

const footerTheme = {
    "root": {
      "base": "w-full rounded-lg bg-white shadow-none md:flex md:items-center md:justify-between dark:bg-gray-900"
    }
  }

export function PublicFooter() {
  return (<>
    <footer>
      <div className="grid grid-cols-12 w-full">

      <Footer theme={footerTheme} container className="col-span-12 md:col-span-8 md:col-start-3">
        <div className="w-full">
          <div className="grid w-full justify-between sm:flex sm:justify-between md:flex md:grid-cols-1">
            <div>
              <FooterBrand
                href="/"
                src="/favicon.svg"
                alt="SGI Logo"
                name="SGI"
                className="text-gray-900 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-8 sm:mt-4 sm:grid-cols-3 sm:gap-6">
              <div>
                <FooterTitle title="Plataforma" className="text-gray-900 dark:text-white" />
                <FooterLinkGroup col>
                  <FooterLink href="/pricing" className="text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400">Planes y Precios</FooterLink>
                  <FooterLink href="/contact" className="text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400">Contacto</FooterLink>
                </FooterLinkGroup>
              </div>
              <div>
                <FooterTitle title="Recursos" className="text-gray-900 dark:text-white" />
                <FooterLinkGroup col>
                  <FooterLink href="/demo" className="text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400">Demo</FooterLink>
                  <FooterLink href="/register" className="text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400">Registro</FooterLink>
                </FooterLinkGroup>
              </div>
              <div>
                <FooterTitle title="Legal" className="text-gray-900 dark:text-white" />
                <FooterLinkGroup col>
                  <FooterLink href="/terms" className="text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400">Términos y Condiciones</FooterLink>
                  <FooterLink href="#" className="text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400">Política de Privacidad</FooterLink>
                </FooterLinkGroup>
              </div>
            </div>
          </div>
          <FooterDivider />
          <div className="w-full sm:flex sm:items-center sm:justify-between">
            <FooterCopyright href="/" by="SGI™" year={2025} className="text-gray-600 dark:text-gray-400" />
            <div className="mt-4 flex space-x-6 sm:mt-0 sm:justify-center">
              <FooterIcon href="#" icon={Facebook} className="text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400" />
              <FooterIcon href="#" icon={Instagram} className="text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400" />
              <FooterIcon href="#" icon={Twitter} className="text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400" />
              <FooterIcon href="#" icon={Github} className="text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400" />
              <FooterIcon href="#" icon={Dribbble} className="text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400" />
            </div>
          </div>
        </div>
      </Footer>
      </div>
    </footer>;
  </>
  );
}