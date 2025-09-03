import React from 'react';
import { BellIcon } from 'lucide-react';
import { useSelector } from 'react-redux';
import { selectUserProfile, selectUserStatus } from '../../store/slices/userSlice';

interface HeaderProps {
  onNotificationsClick: () => void;
  notificationCount: number;
}

// Helper function to get initials from a name
const getInitials = (firstName = '', lastName = '') => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

export function Header({
  /* onNotificationsClick,
  notificationCount*/
}: HeaderProps) {
  const userProfile = useSelector(selectUserProfile);
  const userStatus = useSelector(selectUserStatus);

  // You can show a loading state or a skeleton here
  if (userStatus === 'loading' || !userProfile) {
    // Optional: Render a loading skeleton for a better UX
    return <header className="bg-[#FDFFFC] h-16 border-b border-gray-200 flex items-center justify-end px-6 shadow-sm">
      <div className="animate-pulse flex items-center">
        <div className="h-10 w-10 rounded-full bg-gray-300 ml-3"></div>
      </div>
    </header>;
  }

  return <header className="bg-[#FDFFFC] h-16 border-b border-gray-200 flex items-center justify-end px-6 shadow-sm">
      <div className="flex items-center">
        <div className="relative mr-4">
          {/* <button onClick={onNotificationsClick} className="p-2 rounded-full hover:bg-[#BEE9E8] transition-colors relative">
            <BellIcon className="text-[#101828]" size={20} />
            {notificationCount > 0 && <span className="absolute top-0 right-0 bg-red-500 text-[#FDFFFC] text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {notificationCount}
              </span>}
          </button> */}
        </div>
        <div className="flex items-center">
          <div className="mr-3 text-right">
            <div className="text-sm font-medium text-[#101828]">
              {userProfile.firstName} {userProfile.lastName}
            </div>
            <div className="text-xs text-gray-500">{userProfile.title}</div>
          </div>
          {/* You can also add logic for an avatar image if it exists */}
          {userProfile.avatarUrl ? (
            <img src={userProfile.avatarUrl} alt="User Avatar" className="h-10 w-10 rounded-full" />
          ) : (
          <div className="h-10 w-10 rounded-full bg-[#62B6CB] flex items-center justify-center text-[#FDFFFC] font-medium">
              {getInitials(userProfile.firstName, userProfile.lastName)}
          </div>
          )}
        </div>
      </div>
    </header>;
}