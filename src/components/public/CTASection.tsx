import React from 'react';
import { PublicSection } from './PublicSection';

export function CTASection() {
  return (
    <PublicSection className="bg-gray-900 text-white">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-6">¿Tienes una inmobiliaria?</h2>
        <p className="text-xl mb-12 text-gray-300 max-w-2xl mx-auto">
          Pruébanos gratis y descubre lo fácil que es gestionar tu negocio desde
          una sola plataforma.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <a href="/demo" className="bg-green-600 text-white px-8 py-4 rounded-xl hover:bg-green-700 transition-colors text-lg font-semibold shadow-md">
            Solicita una demo
          </a>
          <a href="/pricing" className="border-2 border-white text-white px-8 py-4 rounded-xl hover:bg-white hover:text-gray-900 transition-colors text-lg font-semibold">
            Ver planes y precios
          </a>
        </div>
      </div>
    </PublicSection>
  );
}