import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { MoonIcon, SunIcon } from 'flowbite-react';

interface CustomDarkThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'minimal' | 'outline';
}

export function CustomDarkThemeToggle({ 
  className = '', 
  size = 'md',
  variant = 'default' 
}: CustomDarkThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const toggleTheme = () => {
    // Simple toggle between light and dark
    if (theme === 'light' || theme === 'system') {
      setTheme('dark');
    } else {
      setTheme('light');
    }
  };

  const getIcon = () => {
    // Show icon based on current resolved theme (what's actually applied)
    const iconSize = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';
    return resolvedTheme === 'dark' ? <MoonIcon className={iconSize} /> : <SunIcon className={iconSize} />;
  };

  const getButtonClasses = () => {
    const baseClasses = "text-gray-500 dark:text-gray-400 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:focus:ring-gray-700 rounded-lg";
    
    const sizeClasses = {
      sm: "text-xs p-1.5",
      md: "text-sm p-2.5", 
      lg: "text-base p-3"
    };

    const variantClasses = {
      default: "hover:bg-gray-100 dark:hover:bg-gray-700",
      minimal: "hover:bg-transparent",
      outline: "border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
    };

    return `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`.trim();
  };

  const getTooltip = () => {
    return resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  };

  return (
    <button
      type="button"
      className={getButtonClasses()}
      onClick={toggleTheme}
      title={getTooltip()}
    >
      {getIcon()}
      <span className="sr-only">{getTooltip()}</span>
    </button>
  );
}
