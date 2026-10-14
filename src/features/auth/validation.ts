import { STUDENT_ID_LENGTH } from '../../config';

/** Keeps digits only and caps the length, so pasted text such as an email still works. */
export function sanitizeStudentId(value: string): string {
  return value.replace(/\D/g, '').slice(0, STUDENT_ID_LENGTH);
}

export function validateStudentId(value: string): string | undefined {
  return /^20\d{7}$/.test(value) ? undefined : 'Student ID must be 9 digits and start with 20.';
}

export function validateSignInPassword(value: string): string | undefined {
  return value ? undefined : 'Password is missing. Enter your password.';
}

export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (value: string) => value.length >= 8 },
  { id: 'uppercase', label: '1 uppercase letter', test: (value: string) => /[A-Z]/.test(value) },
  { id: 'number', label: '1 number', test: (value: string) => /\d/.test(value) },
  { id: 'special', label: '1 special character', test: (value: string) => /[^A-Za-z0-9\s]/.test(value) },
] as const;

export function validateNewPassword(value: string): string | undefined {
  return PASSWORD_RULES.every((rule) => rule.test(value))
    ? undefined
    : 'Password is missing some requirements. Meet every item in the list below.';
}

/** One letter, uppercased. Anything else is dropped as the person types. */
export function sanitizeMiddleInitial(value: string): string {
  return value.replace(/[^\p{L}]/gu, '').slice(0, 1).toUpperCase();
}

export function validateRequiredName(value: string, label: string): string | undefined {
  return value.trim() ? undefined : `${label} is missing. Enter your ${label.toLowerCase()}.`;
}

export function validateSelection(value: string, label: string): string | undefined {
  return value ? undefined : `${label} is not selected. Select your ${label.toLowerCase()}.`;
}