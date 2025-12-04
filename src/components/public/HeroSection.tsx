import React from 'react';
import { PageHero } from './PageHero';
import { Smartphone } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              Tu inmobiliaria, en el centro del mundo digital
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
              Plataforma SaaS para inmobiliarias modernas
            </p>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-12">
              Publica tus propiedades. Administra tu sitio web. Llega a más clientes.
            </p>
            <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4">
              <a href="/register" className="bg-green-600 text-white px-8 py-4 rounded-xl hover:bg-green-700 transition-colors text-lg font-semibold shadow-md">
                Comenzar ahora
              </a>
              <a href="/demo" className="border-2 border-green-600 text-green-600 dark:text-green-400 px-8 py-4 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-lg font-semibold">
                Solicitar demo
              </a>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-sm">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-full mb-4">
                  <Smartphone className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  App Preview
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Gestiona tus propiedades desde cualquier dispositivo
                </p>
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                    <div className="w-4 h-4 bg-white rounded-sm"></div>
                  </div>
                  <div className="flex-1">
                    <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded"></div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <div className="w-4 h-4 bg-white rounded-sm"></div>
                  </div>
                  <div className="flex-1">
                    <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded"></div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                    <div className="w-4 h-4 bg-white rounded-sm"></div>
                  </div>
                  <div className="flex-1">
                    <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}