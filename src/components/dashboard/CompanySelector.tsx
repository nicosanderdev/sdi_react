import { Dropdown, DropdownItem, DropdownDivider } from 'flowbite-react';
import { useSelector } from 'react-redux';
import { selectUserCompanies, selectHasCompanies, selectUserProfile } from '../../store/slices/userSlice';
import { hasRole } from '../../utils/RoleUtils';
import { Roles } from '../../models/Roles';

export type CompanySelectorMode = 'all-options' | 'companies-only' | 'without-all';

export interface CompanySelectorProps {
  mode: CompanySelectorMode;
  value?: string;
  onChange: (selectedCompanyIdOrSpecialOption: string) => void;
  className?: string;
  disabled?: boolean;
}

// Special option values
export const COMPANY_SELECTOR_OPTIONS = {
  ALL_PROPERTIES: 'all',
  MY_PROPERTIES: 'my',
  ALL_COMPANIES: 'all-companies',
} as const;

export function CompanySelector({
  mode,
  value,
  onChange,
  className = '',
  disabled = false,
}: CompanySelectorProps) {
  const companies = useSelector(selectUserCompanies);
  const hasCompanies = useSelector(selectHasCompanies);
  const userProfile = useSelector(selectUserProfile);

  // Check if user has global admin role (Members.Role)
  const hasAdminRole = userProfile ? hasRole(userProfile, Roles.Admin) : false;

  // Don't render the selector if user has no companies
  if (!hasCompanies) {
    return null;
  }

  const getDisplayLabel = (): string => {
    if (!value) {
      if (mode === 'companies-only') {
        return hasCompanies ? companies[0]?.name || 'Select company' : 'No companies available';
      }
      return 'My Properties';
    }

    if (value === COMPANY_SELECTOR_OPTIONS.MY_PROPERTIES) {
      return 'My Properties';
    }
    if (value === COMPANY_SELECTOR_OPTIONS.ALL_PROPERTIES) {
      return 'All';
    }
    if (value === COMPANY_SELECTOR_OPTIONS.ALL_COMPANIES) {
      return 'All companies';
    }

    const selectedCompany = companies.find((c) => c.id === value);
    return selectedCompany?.name || 'Select company';
  };

  const handleItemClick = (selectedValue: string) => {
    if (!disabled) {
      onChange(selectedValue);
    }
  };

  if (mode === 'companies-only' && !hasCompanies) {
    return (
      <Dropdown
        label={getDisplayLabel()}
        className={className}
        disabled={disabled}
      >
        <DropdownItem disabled>No companies available</DropdownItem>
      </Dropdown>
    );
  }

  // If user doesn't have admin role, only show "My Properties" option
  if (!hasAdminRole) {
    return (
      <Dropdown
        label="My Properties"
        className={className}
        disabled={disabled}
      >
        <DropdownItem disabled>My Properties</DropdownItem>
      </Dropdown>
    );
  }

  return (
    <Dropdown
      label={getDisplayLabel()}
      className={className}
      disabled={disabled}
    >
      {mode === 'all-options' && (
        <>
          <DropdownItem onClick={() => handleItemClick(COMPANY_SELECTOR_OPTIONS.MY_PROPERTIES)}>
            My Properties
          </DropdownItem>
          <DropdownItem onClick={() => handleItemClick(COMPANY_SELECTOR_OPTIONS.ALL_PROPERTIES)}>
            All
          </DropdownItem>
          {hasCompanies && <DropdownDivider />}
        </>
      )}

      {mode === 'companies-only' && hasCompanies && <DropdownDivider />}

      {mode === 'without-all' && (
        <>
          <DropdownItem onClick={() => handleItemClick(COMPANY_SELECTOR_OPTIONS.MY_PROPERTIES)}>
            My Properties
          </DropdownItem>
          {hasCompanies && <DropdownDivider />}
        </>
      )}

      {hasCompanies ? (
        companies.map((company) => (
          <DropdownItem
            key={company.id}
            onClick={() => handleItemClick(company.id)}
          >
            {company.name}
          </DropdownItem>
        ))
      ) : mode === 'companies-only' ? (
        <DropdownItem disabled>No companies available</DropdownItem>
      ) : null}
    </Dropdown>
  );
}

