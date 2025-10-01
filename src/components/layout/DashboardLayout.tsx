import { useState } from 'react';
import { DashboardSidebar } from './DashboardSidebar';
import { HeaderLayout } from './HeaderLayout';
import { Outlet } from 'react-router-dom';

export function DashboardLayout() {
  const [showNotifications, setShowNotifications] = useState(false);
  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  return (
    <>
      <div className="flex h-screen bg-secondary-50 text-primary-800 dark:bg-gray-700 dark:text-primary-50">
        <div className='flex h-full w-full'>
          <DashboardSidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <HeaderLayout />
            <main className="flex-1 overflow-y-auto p-6">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </>
  )
}