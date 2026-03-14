import React from 'react';
import { Avatar, Badge } from 'flowbite-react';
import { Mail, Phone } from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'online' | 'offline' | 'busy';
  avatar?: string;
  phone?: string;
}

interface TeamMemberCardProps {
  title?: string;
  members: TeamMember[];
  className?: string;
}

const getStatusColor = (status: TeamMember['status']) => {
  switch (status) {
    case 'online':
      return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
    case 'offline':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    case 'busy':
      return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
};

const getStatusLabel = (status: TeamMember['status']) => {
  switch (status) {
    case 'online':
      return 'En línea';
    case 'offline':
      return 'Fuera de línea';
    case 'busy':
      return 'Ocupado';
    default:
      return 'Desconocido';
  }
};

export function TeamMemberCard({
  title = "Equipo de Trabajo",
  members,
  className = ''
}: TeamMemberCardProps) {
  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm p-4 md:p-6 ${className}`}>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">{title}</h3>

      <div className="space-y-4">
        {members.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">
            No hay miembros del equipo
          </p>
        ) : (
          members.map((member) => (
            <div key={member.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <div className="relative">
                <Avatar
                  img={member.avatar}
                  alt={member.name}
                  rounded
                  size="sm"
                />
                <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${getStatusColor(member.status)}`} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {member.name}
                  </h4>
                  <Badge className={`text-xs ${getStatusColor(member.status)} ml-2 shrink-0`}>
                    {getStatusLabel(member.status)}
                  </Badge>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {member.role}
                </p>

                <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center">
                    <Mail className="w-3 h-3 mr-1" />
                    <span className="truncate">{member.email}</span>
                  </div>
                  {member.phone && (
                    <div className="flex items-center">
                      <Phone className="w-3 h-3 mr-1" />
                      <span>{member.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
