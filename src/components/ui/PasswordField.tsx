import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { TextField, type TextFieldProps } from './TextField';

type PasswordFieldProps = Omit<TextFieldProps, 'type' | 'trailing' | 'suffix'>;

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  props,
  ref,
) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...props}
      ref={ref}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          aria-controls={props.id}
          aria-pressed={visible}
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-control text-charcoal-500 hover:text-charcoal-900"
        >
          {visible ? <EyeOff aria-hidden="true" className="h-5 w-5" /> : <Eye aria-hidden="true" className="h-5 w-5" />}
        </button>
      }
    />
  );
});