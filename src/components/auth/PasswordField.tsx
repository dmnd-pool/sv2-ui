import { forwardRef, useState } from 'react';
import { LiEye, LiEyeClosed, LiLockPassword } from 'solar-icon-react/li';
import { Input, type InputProps } from '@/components/ui/input';
import { filledInputClass } from '@/components/auth/AuthField';
import { cn } from '@/lib/utils';

/** Dark, filled password input with a lock icon, icon/text divider, and a show/hide toggle. */
export const PasswordField = forwardRef<HTMLInputElement, InputProps>(
  ({ className, placeholder = 'Enter your password', ...props }, ref) => {
    const [show, setShow] = useState(false);
    return (
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center gap-1.5 pl-4">
          <LiLockPassword className="h-3.5 w-3.5 text-body-alt" />
          <span className="h-6 w-px bg-border" />
        </div>
        <Input
          ref={ref}
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          className={cn(filledInputClass, 'pl-[44px] pr-10', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-body-alt transition-colors hover:text-foreground"
        >
          {show ? <LiEyeClosed className="h-3.5 w-3.5" /> : <LiEye className="h-3.5 w-3.5" />}
        </button>
      </div>
    );
  },
);
PasswordField.displayName = 'PasswordField';
