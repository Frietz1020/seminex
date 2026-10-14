import type { Block, EditableProfile, Program, YearLevel } from '../../api/types';
import { validateRequiredName, validateSelection } from '../auth/validation';

export interface ProfileFormValues {
  firstName: string;
  lastName: string;
  middleInitial: string;
  program: string;
  yearLevel: string;
  block: string;
}

export type ProfileFieldName = 'firstName' | 'lastName' | 'program' | 'yearLevel' | 'block';
export type ProfileFieldErrors = Partial<Record<ProfileFieldName, string>>;

/** Visual order of the fields, which is also the order focus moves to the first error. */
export const PROFILE_FIELD_ORDER: readonly ProfileFieldName[] = [
  'firstName',
  'lastName',
  'program',
  'yearLevel',
  'block',
];

export function toFormValues(profile: EditableProfile): ProfileFormValues {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    middleInitial: profile.middleInitial,
    program: profile.program,
    yearLevel: String(profile.yearLevel),
    block: profile.block,
  };
}

/** Same rules as Sign Up: names are required, the M.I. is one optional letter, selections are required. */
export function validateProfileField(field: ProfileFieldName, values: ProfileFormValues): string | undefined {
  switch (field) {
    case 'firstName':
      return validateRequiredName(values.firstName, 'First name');
    case 'lastName':
      return validateRequiredName(values.lastName, 'Last name');
    case 'program':
      return validateSelection(values.program, 'Program');
    case 'yearLevel':
      return validateSelection(values.yearLevel, 'Year level');
    case 'block':
      return validateSelection(values.block, 'Block');
  }
}

export function validateProfile(values: ProfileFormValues): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {};
  for (const field of PROFILE_FIELD_ORDER) {
    const message = validateProfileField(field, values);
    if (message) errors[field] = message;
  }
  return errors;
}

/** Call only after validateProfile found no errors. */
export function toEditableProfile(values: ProfileFormValues): EditableProfile {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    middleInitial: values.middleInitial,
    program: values.program as Program,
    yearLevel: Number(values.yearLevel) as YearLevel,
    block: values.block as Block,
  };
}