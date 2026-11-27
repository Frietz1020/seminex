import { forwardRef, useState } from 'react';
import { Icon } from './Icon';
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
          <Icon name={visible ? 'visibility_off' : 'visibility'} size={20} />
        </button>
      }
    />
  );
});