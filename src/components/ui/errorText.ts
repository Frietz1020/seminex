import type { ApiErrorCode } from '../../api/types';

export function errorText(code: ApiErrorCode): string {
  switch (code) {
    case 'network':
      return 'Seminex could not be reached. Check your connection and try again.';
    case 'not_found':
      return 'That item could not be found. It may have been removed.';
    case 'seminar_full':
      return 'This seminar has no slots left.';
    case 'not_available':
      return 'This is not available yet.';
    case 'session_expired':
      return 'Your session ended. Sign in again to continue.';
    default:
      return 'Something went wrong. Try again.';
  }
}