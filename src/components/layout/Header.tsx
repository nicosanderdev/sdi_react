import React from 'react';
import { BellIcon } from 'lucide-react';
interface HeaderProps {
  onNotificationsClick: () => void;
  notificationCount: number;
}
export function Header({
  onNotificationsClick,
  notificationCount
}: HeaderProps) {
  return <header className="bg-[#FDFFFC] h-16 border-b border-gray-200 flex items-center justify-end px-6 shadow-sm">
      <div className="flex items-center">
        <div className="relative mr-4">
          <button onClick={onNotificationsClick} className="p-2 rounded-full hover:bg-[#BEE9E8] transition-colors relative">
            <BellIcon className="text-[#101828]" size={20} />
            {notificationCount > 0 && <span className="absolute top-0 right-0 bg-red-500 text-[#FDFFFC] text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {notificationCount}
              </span>}
          </button>
        </div>
        <div className="flex items-center">
          <div className="mr-3 text-right">
            <div className="text-sm font-medium text-[#101828]">
              Carlos Rodríguez
            </div>
            <div className="text-xs text-gray-500">Agente Senior</div>
          </div>
          <div className="h-10 w-10 rounded-full bg-[#62B6CB] flex items-center justify-center text-[#FDFFFC] font-medium">
            CR
          </div>
        </div>
      </div>
    </header>;
}