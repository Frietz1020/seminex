import { AVATAR_MAX_BYTES, AVATAR_MAX_LABEL, AVATAR_TYPES } from '../../config';

/** Returns a plain message when the file cannot be used as a photo, or undefined when it can. */
export function validateAvatarFile(file: File): string | undefined {
  if (!AVATAR_TYPES.some((type) => type === file.type)) {
    return 'That file is not a PNG or JPG image. Choose a PNG or JPG photo.';
  }
  if (file.size > AVATAR_MAX_BYTES) {
    const megabytes = (file.size / (1024 * 1024)).toFixed(1);
    return `That photo is ${megabytes}MB, over the ${AVATAR_MAX_LABEL} limit. Choose a smaller photo.`;
  }
  return undefined;
}