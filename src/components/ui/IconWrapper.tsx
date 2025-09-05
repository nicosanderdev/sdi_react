import React from 'react';
import { LucideIcon } from 'lucide-react';

interface IconWrapperProps {
  icon: LucideIcon;
  size?: number;
  iconBgColor?: string;
  iconColor?: string;
  padding?: string;
  className?: string;
  hoverable?: boolean;
}

export function IconWrapper({
  icon: Icon,
  size = 20,
  iconBgColor = 'bg-primary-200',
  iconColor = 'text-primary-800',
  padding = 'p-2',
  className = '',
  hoverable = false
}: IconWrapperProps) {
  return (
    <div className={`${padding} ${iconBgColor} rounded-full ${className} ${hoverable ? 'hover:bg-primary-300 transition-colors ' : ''}`}>
      <Icon size={size} className={iconColor} />
    </div>
  );
}
