import { useSelector } from 'react-redux';
import { selectUserProfile, selectUserStatus } from '../../store/slices/userSlice';
import { Avatar, Dropdown, DropdownDivider, DropdownHeader, DropdownItem, Navbar } from 'flowbite-react';
import { CustomDarkThemeToggle } from '../ui/CustomDarkThemeToggle';

interface HeaderProps {
  onNotificationsClick: () => void;
  notificationCount: number;
}

// Helper function to get initials from a name
const getInitials = (firstName = '', lastName = '') => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

export function HeaderLayout() {
  const userProfile = useSelector(selectUserProfile);
  const userStatus = useSelector(selectUserStatus);

  // You can show a loading state or a skeleton here
  {/* if (userStatus === 'loading' || !userProfile) {
    // Optional: Render a loading skeleton for a better UX
    return <header className="bg-[#FDFFFC] h-16 border-b border-gray-200 flex items-center justify-end px-6 shadow-sm">
      <div className="animate-pulse flex items-center">
        <div className="h-10 w-10 rounded-full bg-gray-300 ml-3"></div>
      </div>
    </header>;
  } */}

  const navbarTheme = {
    "root": {
      "base": "bg-gray-50 px-2 py-2.5 sm:px-4 dark:border-gray-700 dark:bg-gray-800",
      "rounded": {
        "on": "",
        "off": ""
      },
      "bordered": {
        "on": "border",
        "off": ""
      },
      "inner": {
        "base": "flex flex-wrap items-center justify-end w-full",
        "fluid": {
          "on": "",
          "off": "container"
        }
      }
    },
    "brand": {
      "base": "flex items-center"
    },
    "collapse": {
      "base": "w-full md:block md:w-auto",
      "list": "mt-4 flex flex-col md:mt-0 md:flex-row md:space-x-8 md:text-sm md:font-medium",
      "hidden": {
        "on": "hidden",
        "off": ""
      }
    },
    "link": {
      "base": "block py-2 pl-3 pr-4 md:p-0",
      "active": {
        "on": "bg-primary-700 text-white md:bg-transparent md:text-primary-700 dark:text-white",
        "off": "border-b border-gray-100 text-gray-700 hover:bg-gray-50 md:border-0 md:hover:bg-transparent md:hover:text-primary-700 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white md:dark:hover:bg-transparent md:dark:hover:text-white"
      },
      "disabled": {
        "on": "text-gray-400 hover:cursor-not-allowed dark:text-gray-600",
        "off": ""
      }
    },
    "toggle": {
      "base": "inline-flex items-center rounded-lg p-2 text-sm text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 md:hidden dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600",
      "icon": "h-6 w-6 shrink-0",
      "title": "sr-only"
    }
  }

  return (
    <>
      <Navbar fluid rounded theme={navbarTheme}>
        <CustomDarkThemeToggle className="mr-3" />
        <Dropdown
          arrowIcon={false}
          inline
          label={
            <Avatar alt="User settings" img="https://flowbite.com/docs/images/people/profile-picture-5.jpg" rounded />
          }
        >
          <DropdownHeader>
            <span className="block text-sm">Bonnie Green</span>
            <span className="block truncate text-sm font-medium">name@flowbite.com</span>
          </DropdownHeader>
          <DropdownItem>Dashboard</DropdownItem>
          <DropdownItem>Settings</DropdownItem>
          <DropdownItem>Earnings</DropdownItem>
          <DropdownDivider />
          <DropdownItem>Sign out</DropdownItem>
        </Dropdown>
      </Navbar>
    </>
  );
}