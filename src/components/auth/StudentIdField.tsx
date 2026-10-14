import { forwardRef } from 'react';
import { TextField, type TextFieldProps } from '../ui/TextField';
import { STUDENT_EMAIL_DOMAIN } from '../../config';
import { sanitizeStudentId } from '../../features/auth/validation';

type StudentIdFieldProps = Omit<
  TextFieldProps,
  'label' | 'hint' | 'suffix' | 'type' | 'inputMode' | 'autoComplete' | 'placeholder' | 'required'
>;

export const StudentIdField = forwardRef<HTMLInputElement, StudentIdFieldProps>(function StudentIdField(
  { onChange, ...props },
  ref,
) {
  return (
    <TextField
      {...props}
      ref={ref}
      label="Student ID"
      required
      hint="9 digits, starts with 20"
      suffix={`@${STUDENT_EMAIL_DOMAIN}`}
      type="text"
      inputMode="numeric"
      autoComplete="username"
      spellCheck={false}
      placeholder="202110482"
      onChange={(value) => onChange(sanitizeStudentId(value))}
    />
  );
});