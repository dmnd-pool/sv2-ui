import { forwardRef, type ComponentType, type ReactNode } from 'react';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface FieldLabelProps {
  htmlFor?: string;
  children: ReactNode;
  required?: boolean;
  optional?: boolean;
}

/**
 * Field label: Geist 400, 14px, #D4D4D4. "Email address *" /
 * "Referral code (Optional)".
 */
export function FieldLabel({ htmlFor, children, required, optional }: FieldLabelProps) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-normal text-foreground">
      {children}
      {required && <span className="text-foreground"> *</span>}
      {optional && <span className="font-normal text-body-alt"> (Optional)</span>}
    </label>
  );
}

/**
 * Shared dark, filled input for the auth screens (exact
 * tokens): 40px tall, 16px radius, #262626 fill, 12px placeholder #737373.
 * Borderless at rest with a 0.5px #FAC2BE focus border (rule in index.css).
 */
export const filledInputClass =
  'h-10 rounded-[16px] border-0 bg-muted px-4 text-xs placeholder:text-placeholder focus-visible:ring-0 focus-visible:ring-offset-0';

type IconType = ComponentType<{ className?: string }>;

interface IconInputProps extends InputProps {
  icon: IconType;
}

/**
 * Dark, filled input with a leading icon (#A3A3A3) and a 0.5px #404040 vertical
 * stroke dividing the icon from the text.
 */
export const IconInput = forwardRef<HTMLInputElement, IconInputProps>(
  ({ icon: Icon, className, ...props }, ref) => (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center gap-1.5 pl-4">
        <Icon className="h-3.5 w-3.5 text-body-alt" />
        <span className="h-6 w-px bg-border" />
      </div>
      <Input ref={ref} className={cn(filledInputClass, 'pl-[44px]', className)} {...props} />
    </div>
  ),
);
IconInput.displayName = 'IconInput';
