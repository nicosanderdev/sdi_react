import { Dropdown, DropdownItem } from 'flowbite-react';
import type { GuestTrackedListingType } from '../../types/guestVisitContract';
import { getListingTypeLabelEs } from '../../models/properties/propertyTypeLabels';

export type GuestSiteFilterValue = GuestTrackedListingType | null;

const OPTIONS: { id: GuestSiteFilterValue; label: string }[] = [
  { id: null, label: 'Todos los sitios' },
  { id: 'SummerRent', label: getListingTypeLabelEs('SummerRent') },
  { id: 'EventVenue', label: getListingTypeLabelEs('EventVenue') },
];

interface GuestSiteFilterProps {
  value: GuestSiteFilterValue;
  onChange: (value: GuestSiteFilterValue) => void;
  className?: string;
}

export function GuestSiteFilter({ value, onChange, className = '' }: GuestSiteFilterProps) {
  const label = OPTIONS.find((o) => o.id === value)?.label ?? 'Todos los sitios';

  return (
    <div className={className}>
      <Dropdown dismissOnClick={true} label={label}>
        {OPTIONS.map((opt) => (
          <DropdownItem key={opt.id ?? 'all'} onClick={() => onChange(opt.id)}>
            {opt.label}
          </DropdownItem>
        ))}
      </Dropdown>
    </div>
  );
}
