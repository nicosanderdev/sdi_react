import { Label, Select, TextInput } from 'flowbite-react';
import {
  DEFAULT_MEMBER_PHONE_PREFIX,
  MEMBER_PHONE_PREFIXES,
} from '../../utils/memberPhone';

interface PhonePrefixInputProps {
  prefix: string;
  phone: string;
  onPrefixChange: (prefix: string) => void;
  onPhoneChange: (phone: string) => void;
  disabled?: boolean;
  error?: string;
  phoneId?: string;
  required?: boolean;
}

export function PhonePrefixInput({
  prefix,
  phone,
  onPrefixChange,
  onPhoneChange,
  disabled = false,
  error,
  phoneId = 'phone',
  required = false,
}: PhonePrefixInputProps) {
  const selectedPrefix = prefix || DEFAULT_MEMBER_PHONE_PREFIX;

  return (
    <div>
      <div className="flex gap-2">
        <div className="w-36 shrink-0">
          <Label htmlFor={`${phoneId}-prefix`} className="sr-only">
            Prefijo
          </Label>
          <Select
            id={`${phoneId}-prefix`}
            value={selectedPrefix}
            onChange={(e) => onPrefixChange(e.target.value)}
            disabled={disabled}
            required={required}
            color={error ? 'failure' : 'gray'}
          >
            {MEMBER_PHONE_PREFIXES.map((item) => (
              <option key={item.prefix} value={item.prefix}>
                {item.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-0 flex-1">
          <Label htmlFor={phoneId} className="sr-only">
            Teléfono
          </Label>
          <TextInput
            id={phoneId}
            type="tel"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="099123456"
            disabled={disabled}
            required={required}
            color={error ? 'failure' : 'gray'}
          />
        </div>
      </div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
