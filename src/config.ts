export const STUDENT_EMAIL_DOMAIN = 'gordoncollege.edu.ph';
export const STUDENT_ID_LENGTH = 9;

/** Placeholder cooldown before the verification email can be sent again. */
export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Minimum share of a seminar a student must attend for a certificate. Used in every piece of copy
 * and as the source for mock seminar data. Business rule that needs confirmation.
 */
export const REQUIRED_ATTENDANCE_PERCENT = 60;

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_MAX_LABEL = '5MB';
export const AVATAR_TYPES = ['image/png', 'image/jpeg'] as const;
export const AVATAR_HINT = 'PNG or JPG, up to 5MB';

/** The signed-in role on the student side of the app. */
export const STUDENT_ROLE_LABEL = 'Student';