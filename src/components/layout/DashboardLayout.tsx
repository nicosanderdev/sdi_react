import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { NotificationsPanel } from '../notifications/NotificationsPanel';
import { Outlet } from 'react-router-dom';

export function DashboardLayout() {
  const [showNotifications, setShowNotifications] = useState(false);
  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };
  return <div className="flex h-screen bg-[#E0ECEC] text-[#1B4965]">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header onNotificationsClick={toggleNotifications} notificationCount={3} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      {showNotifications && <div className="absolute right-0 top-16 w-80 z-50">
          <NotificationsPanel onClose={() => setShowNotifications(false)} />
        </div>}
    </div>;
}