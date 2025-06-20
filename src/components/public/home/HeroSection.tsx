import React from 'react';
export function HeroSection() {
  return <section className="bg-gradient-to-b from-[#BEE9E8] to-[#FDFFFC] py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold text-[#101828] mb-6">
            Tu inmobiliaria, en el centro del mundo digital
          </h1>
          <p className="text-xl text-[#101828] mb-8">
            Plataforma SaaS para inmobiliarias modernas
          </p>
          <p className="text-lg text-[#101828] mb-12">
            Publica tus propiedades. Administra tu sitio web. Llega a más
            clientes.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a href="/register" className="bg-[#62B6CB] text-[#FDFFFC] px-8 py-3 rounded-md hover:opacity-90 transition-colors text-lg font-medium">
              Comenzar ahora
            </a>
            <a href="/demo" className="border-2 border-[#62B6CB] text-[#62B6CB] px-8 py-3 rounded-md hover:bg-[#62B6CB] hover:text-[#FDFFFC] transition-colors text-lg font-medium">
              Solicitar demo
            </a>
          </div>
        </div>
      </div>
    </section>;
}