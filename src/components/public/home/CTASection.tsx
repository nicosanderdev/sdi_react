import React from 'react';
export function CTASection() {
  return <section className="py-20 bg-[#1B4965] text-[#FDFFFC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold mb-6">¿Tienes una inmobiliaria?</h2>
        <p className="text-xl mb-12 text-gray-300">
          Pruébanos gratis y descubre lo fácil que es gestionar tu negocio desde
          una sola plataforma.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <a href="/demo" className="bg-[#62B6CB] text-[#FDFFFC] px-8 py-3 rounded-md hover:opacity-90 transition-colors text-lg font-medium">
            Solicita una demo
          </a>
          <a href="/pricing" className="border-2 border-[#FDFFFC] text-[#FDFFFC] px-8 py-3 rounded-md hover:bg-[#FDFFFC] hover:text-[#1B4965] transition-colors text-lg font-medium">
            Ver planes y precios
          </a>
        </div>
      </div>
    </section>;
}