/**
 * Shared phone number validation utilities for consistent validation across the app.
 */

/**
 * Checks if a phone number is valid (exactly 10 digits, not "Unknown" or empty)
 */
export function isValidPhoneNumber(phoneNumber: string | undefined | null): boolean {
  if (!phoneNumber || phoneNumber === 'Unknown' || phoneNumber.trim() === '') {
    return false;
  }
  
  // Must be exactly 10 digits
  if (phoneNumber.length !== 10) {
    return false;
  }
  
  // Must contain only digits
  return /^\d{10}$/.test(phoneNumber);
}

/**
 * Normalizes input to digits only
 */
export function normalizePhoneInput(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * Gets a user-friendly validation message for invalid phone numbers
 */
export function getPhoneValidationMessage(phoneNumber: string): string | null {
  if (!phoneNumber || phoneNumber.trim() === '') {
    return 'Phone number is required';
  }
  
  if (phoneNumber.length < 10) {
    return `Phone number must be exactly 10 digits (${phoneNumber.length}/10)`;
  }
  
  if (phoneNumber.length > 10) {
    return 'Phone number must be exactly 10 digits';
  }
  
  if (!/^\d+$/.test(phoneNumber)) {
    return 'Phone number must contain only digits (0-9)';
  }
  
  return null;
}
