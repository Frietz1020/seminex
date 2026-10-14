/**
 * Programs, year levels, and blocks. The one source for Sign Up, Profile, and any text that
 * names them, so the lists are never typed twice.
 */
import type { Block, Program, YearLevel } from '../api/types';

export interface AcademicOption {
  value: string;
  label: string;
}

export const PROGRAMS: readonly AcademicOption[] = [
  { value: 'CS', label: 'Computer Science' },
  { value: 'IT', label: 'Information Technology' },
  { value: 'EMC', label: 'Entertainment and Multimedia Computing' },
];

/** Short program codes for the top bar. ASSUMED: confirm the official codes with the college. */
const PROGRAM_CODES: Record<Program, string> = { CS: 'BSCS', IT: 'BSIT', EMC: 'BSEMC' };

export function programCode(program: Program): string {
  return PROGRAM_CODES[program];
}

export const YEAR_LEVELS: readonly AcademicOption[] = [
  { value: '1', label: '1st year' },
  { value: '2', label: '2nd year' },
  { value: '3', label: '3rd year' },
  { value: '4', label: '4th year' },
];

export const BLOCKS: readonly AcademicOption[] = ['A', 'B', 'C', 'D', 'E', 'F'].map((letter) => ({
  value: letter,
  label: `Block ${letter}`,
}));

export function programLabel(program: Program): string {
  return PROGRAMS.find((option) => option.value === program)?.label ?? program;
}

export function yearLevelLabel(level: YearLevel): string {
  return YEAR_LEVELS.find((option) => option.value === String(level))?.label ?? `${level}th year`;
}

export function blockLabel(block: Block): string {
  return BLOCKS.find((option) => option.value === block)?.label ?? `Block ${block}`;
}