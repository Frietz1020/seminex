export const STUDENT_EMAIL_DOMAIN = 'gordoncollege.edu.ph';
export const STUDENT_ID_LENGTH = 9;

/** Placeholder cooldown before the verification email can be sent again. */
export const RESEND_COOLDOWN_SECONDS = 60;

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_MAX_LABEL = '5MB';
export const AVATAR_TYPES = ['image/png', 'image/jpeg'] as const;
export const AVATAR_HINT = 'PNG or JPG, up to 5MB';

export const WEBINAR_TIME_IN_START_OFFSET_MINUTES = 0;
export const WEBINAR_TIME_OUT_START_OFFSET_MINUTES = 15;
export const WEBINAR_TIME_OUT_END_OFFSET_MINUTES = 60;

/** The signed-in role on the student side of the app. */
export const STUDENT_ROLE_LABEL = 'Student';
