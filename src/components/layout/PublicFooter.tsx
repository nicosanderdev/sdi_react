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
      "base": "w-full rounded-lg bg-white shadow-none md:flex md:items-center md:justify-between dark:bg-gray-800"
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
                href="https://flowbite.com"
                src="https://flowbite.com/docs/images/logo.svg"
                alt="Flowbite Logo"
                name="Flowbite"
              />
            </div>
            <div className="grid grid-cols-2 gap-8 sm:mt-4 sm:grid-cols-3 sm:gap-6">
              <div>
                <FooterTitle title="about" />
                <FooterLinkGroup col>
                  <FooterLink href="#">Flowbite</FooterLink>
                  <FooterLink href="#">Tailwind CSS</FooterLink>
                </FooterLinkGroup>
              </div>
              <div>
                <FooterTitle title="Follow us" />
                <FooterLinkGroup col>
                  <FooterLink href="#">Github</FooterLink>
                  <FooterLink href="#">Discord</FooterLink>
                </FooterLinkGroup>
              </div>
              <div>
                <FooterTitle title="Legal" />
                <FooterLinkGroup col>
                  <FooterLink href="#">Privacy Policy</FooterLink>
                  <FooterLink href="#">Terms & Conditions</FooterLink>
                </FooterLinkGroup>
              </div>
            </div>
          </div>
          <FooterDivider />
          <div className="w-full sm:flex sm:items-center sm:justify-between">
            <FooterCopyright href="#" by="Flowbite™" year={2025} />
            <div className="mt-4 flex space-x-6 sm:mt-0 sm:justify-center">
              <FooterIcon href="#" icon={Facebook} />
              <FooterIcon href="#" icon={Instagram} />
              <FooterIcon href="#" icon={Twitter} />
              <FooterIcon href="#" icon={Github} />
              <FooterIcon href="#" icon={Dribbble} />
            </div>
          </div>
        </div>
      </Footer>
      </div>
    </footer>;
  </>
  );
}