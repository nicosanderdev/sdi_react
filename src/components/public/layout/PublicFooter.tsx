import React from 'react';
export function PublicFooter() {
  return <footer className="bg-[#1B4965] text-[#FDFFFC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-lg font-semibold mb-4">InmoGestión</h3>
            <p className="text-sm text-gray-300">
              Plataforma SaaS para inmobiliarias modernas
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-4">Producto</h4>
            <ul className="space-y-2">
              <li>
                <a href="/features" className="text-sm text-gray-300 hover:text-[#FDFFFC]">
                  Características
                </a>
              </li>
              <li>
                <a href="/pricing" className="text-sm text-gray-300 hover:text-[#FDFFFC]">
                  Precios
                </a>
              </li>
              <li>
                <a href="/demo" className="text-sm text-gray-300 hover:text-[#FDFFFC]">
                  Solicitar demo
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-4">Soporte</h4>
            <ul className="space-y-2">
              <li>
                <a href="/contact" className="text-sm text-gray-300 hover:text-[#FDFFFC]">
                  Contacto
                </a>
              </li>
              <li>
                <a href="/help" className="text-sm text-gray-300 hover:text-[#FDFFFC]">
                  Centro de ayuda
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-4">Legal</h4>
            <ul className="space-y-2">
              <li>
                <a href="/privacy" className="text-sm text-gray-300 hover:text-[#FDFFFC]">
                  Privacidad
                </a>
              </li>
              <li>
                <a href="/terms" className="text-sm text-gray-300 hover:text-[#FDFFFC]">
                  Términos
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-700">
          <p className="text-sm text-gray-300 text-center">
            © {new Date().getFullYear()} InmoGestión. Todos los derechos
            reservados.
          </p>
        </div>
      </div>
    </footer>;
}