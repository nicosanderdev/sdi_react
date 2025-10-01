import React from 'react';

interface Props {
  icon: React.ReactNode;
  children: React.ReactNode;
}

function IconLabel({ icon, children }: Props) {
  return (
    <div className="flex items-center space-x-2 text-gray-700">
      <span className="text-blue-600">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

export default IconLabel;