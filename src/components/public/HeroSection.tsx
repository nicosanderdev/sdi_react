import React from 'react';

export function HeroSection() {
  return (
    <section className="bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Tu inmobiliaria, en el centro del mundo digital
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
            Plataforma SaaS para inmobiliarias modernas
          </p>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-12">
            Publica tus propiedades. Administra tu sitio web. Llega a más clientes.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a href="/demo" className="border-2 border-green-600 text-green-600 dark:text-green-400 px-8 py-4 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-lg font-semibold">
              Solicitar demo
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}