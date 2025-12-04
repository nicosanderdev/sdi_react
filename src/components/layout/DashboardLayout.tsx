import { DashboardSidebar } from './DashboardSidebar';
import { HeaderLayout } from './HeaderLayout';
import { Outlet } from 'react-router-dom';


export function DashboardLayout() {

  return (
    <>
      <div className="flex h-screen bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
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