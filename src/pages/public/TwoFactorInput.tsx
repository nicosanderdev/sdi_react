// src/components/public/form/TwoFactorInput.tsx

import React, { useRef, createRef } from 'react';

// Define the props for our component
interface TwoFactorInputProps {
  length: number;
  value: string;
  onChange: (value: string) => void;
  onComplete: (value: string) => void;
  disabled?: boolean;
}

export const TwoFactorInput: React.FC<TwoFactorInputProps> = ({
  length,
  value,
  onChange,
  onComplete,
  disabled = false,
}) => {
  // Create an array of refs, one for each input
  const inputRefs = useRef<React.RefObject<HTMLInputElement>[]>(
    Array.from({ length }, () => createRef<HTMLInputElement>())
  );

  // Splits the value string into an array of single characters
  const valueItems = value.padEnd(length, ' ').split('');

  const focusToInput = (index: number) => {
    const ref = inputRefs.current[index];
    if (ref && ref.current) {
      ref.current.focus();
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number
  ) => {
    const newChar = e.target.value.slice(-1); // Get the last character entered
    const oldVal = valueItems[index];

    // Only allow numeric input
    if (!/^\d?$/.test(newChar)) {
        return;
    }
    
    // Create the new value string
    const newValue = [...valueItems];
    newValue[index] = newChar;
    const newStringValue = newValue.join('').trim();
    onChange(newStringValue);

    // If a character was added, move to the next input
    if (newChar && oldVal === ' ') {
      if (index < length - 1) {
        focusToInput(index + 1);
      }
    }
    
    // Check for completion
    if (newStringValue.length === length) {
        onComplete(newStringValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      // If the current input is empty, move to the previous input and clear it
      if (valueItems[index] === ' ') {
        if (index > 0) {
          const newValue = [...valueItems];
          newValue[index - 1] = ' '; // Clear previous input
          onChange(newValue.join('').trim());
          focusToInput(index - 1);
        }
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      focusToInput(index - 1);
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      focusToInput(index + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData
      .getData('text')
      .replace(/\D/g, '') // Remove non-digits
      .slice(0, length); // Trim to the expected length
    
    onChange(pastedData);

    if (pastedData.length === length) {
        onComplete(pastedData);
        // Focus on the last input after paste
        const lastInputIndex = Math.max(0, pastedData.length - 1);
        focusToInput(lastInputIndex);
    }
  };

  return (
    <div className="flex justify-center gap-2 md:gap-3" onPaste={handlePaste}>
      {valueItems.map((char, index) => (
        <input
          key={index}
          ref={inputRefs.current[index]}
          type="text" // Use text to properly handle single char input and selection
          inputMode="numeric" // Helps mobile users get a number pad
          pattern="[0-9]*"
          maxLength={1}
          value={char.trim()}
          onChange={(e) => handleInputChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          className="w-12 h-14 md:w-14 md:h-16 text-center text-2xl md:text-3xl font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#62B6CB] transition duration-200"
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  );
};