import React from 'react';
import { Card } from 'flowbite-react';
import { LucideIcon } from 'lucide-react';
import { IconWrapper } from '../ui/IconWrapper';

interface DashboardCardProps {
  title: string;
  value: React.ReactNode;
  icon: LucideIcon;
  iconBgColor?: string;
  iconColor?: string;
  subtitle?: React.ReactNode;
  className?: string;
}

export function DashboardCard({
  title,
  value,
  icon: Icon,
  subtitle,
  className = ''
}: DashboardCardProps) {
  return (
    <Card className={className}>
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-medium">{title}</h3>
        <IconWrapper
          icon={Icon}
        />
      </div>
      <div className="text-3xl font-bold">
        {value}
      </div>
      {subtitle && (
        <div className="mt-2">
          {subtitle}
        </div>
      )}
    </Card>
  );
}
