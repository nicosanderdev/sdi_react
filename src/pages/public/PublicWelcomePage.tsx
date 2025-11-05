import React from 'react';
import { Link } from 'react-router-dom';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { 
  User, 
  MessageSquare, 
  Heart, 
  Search, 
  Settings, 
  Crown,
  Home,
  Mail
} from 'lucide-react';

export function PublicWelcomePage() {
  const user = useSelector((state: RootState) => state.user.profile);

  const quickActions = [
    {
      title: 'Mi Perfil',
      description: 'Gestiona tu información personal',
      icon: <User className="w-8 h-8" />,
      link: '/profile',
      color: 'bg-blue-500'
    },
    {
      title: 'Mis Mensajes',
      description: 'Ve las respuestas a tus consultas',
      icon: <MessageSquare className="w-8 h-8" />,
      link: '/messages',
      color: 'bg-green-500'
    },
    {
      title: 'Propiedades Favoritas',
      description: 'Tus propiedades guardadas',
      icon: <Heart className="w-8 h-8" />,
      link: '/favorites',
      color: 'bg-red-500'
    },
    {
      title: 'Buscar Propiedades',
      description: 'Explora nuevas oportunidades',
      icon: <Search className="w-8 h-8" />,
      link: '/properties',
      color: 'bg-purple-500'
    }
  ];

  const upgradeSection = {
    title: 'Conviértete en Manager',
    description: 'Gestiona tus propias propiedades y accede a herramientas profesionales',
    icon: <Crown className="w-8 h-8" />,
    link: '/upgrade',
    color: 'bg-yellow-500'
  };

  return (
    <PublicLayout>
      <div className="min-h-screen bg-gradient-to-b from-[#BEE9E8] to-[#FDFFFC]">
        {/* Header Section */}
        <div className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-[#1B4965]">
                  ¡Bienvenido, {user?.firstName || 'Usuario'}!
                </h1>
                <p className="text-gray-600 mt-2">
                  Gestiona tu cuenta y explora propiedades desde tu panel personal
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <Link
                  to="/profile"
                  className="flex items-center space-x-2 bg-[#1B4965] text-white px-4 py-2 rounded-lg hover:bg-[#153a52] transition-colors"
                >
                  <Settings className="w-5 h-5" />
                  <span>Configuración</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Quick Actions Grid */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-[#1B4965] mb-6">Accesos Rápidos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {quickActions.map((action, index) => (
                <Link
                  key={index}
                  to={action.link}
                  className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6 group"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`${action.color} text-white rounded-lg p-3 group-hover:scale-110 transition-transform`}>
                      {action.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#1B4965] group-hover:text-[#153a52] transition-colors">
                        {action.title}
                      </h3>
                      <p className="text-gray-600 text-sm">
                        {action.description}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Upgrade Section */}
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg p-8 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="bg-white bg-opacity-20 rounded-lg p-3">
                  {upgradeSection.icon}
                </div>
                <div>
                  <h3 className="text-2xl font-bold">
                    {upgradeSection.title}
                  </h3>
                  <p className="text-white text-opacity-90 mt-2">
                    {upgradeSection.description}
                  </p>
                </div>
              </div>
              <Link
                to={upgradeSection.link}
                className="bg-white text-yellow-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
              >
                Actualizar Ahora
              </Link>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-[#1B4965] mb-6">Actividad Reciente</h2>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                  <Mail className="w-6 h-6 text-blue-500" />
                  <div>
                    <p className="font-medium text-[#1B4965]">Nueva respuesta recibida</p>
                    <p className="text-gray-600 text-sm">Tienes una nueva respuesta a tu consulta sobre la propiedad en Madrid</p>
                  </div>
                  <span className="text-sm text-gray-500 ml-auto">Hace 2 horas</span>
                </div>
                <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                  <Heart className="w-6 h-6 text-red-500" />
                  <div>
                    <p className="font-medium text-[#1B4965]">Propiedad agregada a favoritos</p>
                    <p className="text-gray-600 text-sm">Agregaste una nueva propiedad a tu lista de favoritos</p>
                  </div>
                  <span className="text-sm text-gray-500 ml-auto">Ayer</span>
                </div>
                <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                  <Search className="w-6 h-6 text-purple-500" />
                  <div>
                    <p className="font-medium text-[#1B4965]">Nueva búsqueda realizada</p>
                    <p className="text-gray-600 text-sm">Buscaste propiedades en Barcelona</p>
                  </div>
                  <span className="text-sm text-gray-500 ml-auto">Hace 3 días</span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="mt-12 flex justify-center space-x-4">
            <Link
              to="/"
              className="flex items-center space-x-2 text-[#1B4965] hover:text-[#153a52] transition-colors"
            >
              <Home className="w-5 h-5" />
              <span>Volver al Inicio</span>
            </Link>
            <span className="text-gray-300">|</span>
            <Link
              to="/properties"
              className="flex items-center space-x-2 text-[#1B4965] hover:text-[#153a52] transition-colors"
            >
              <Search className="w-5 h-5" />
              <span>Explorar Propiedades</span>
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
