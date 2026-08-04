import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

/**
 * `lg` is the design's Large toggle: a 40x18 track with a 24x16 rounded thumb that
 * carries a shadow only while on. The default size is the shadcn one, left alone for
 * surfaces whose frames have not been measured.
 */
type SwitchSize = "default" | "lg"

const TRACK: Record<SwitchSize, string> = {
  default: "h-5 w-9 rounded-full border-2 border-transparent shadow-sm",
  lg: "h-[18px] w-10 rounded-[16px] p-px",
}

const THUMB: Record<SwitchSize, string> = {
  default: "h-4 w-4 rounded-full shadow-lg data-[state=checked]:translate-x-4",
  lg: "h-4 w-6 rounded-[8px] data-[state=checked]:translate-x-3.5 data-[state=checked]:shadow-[-8px_8px_15px_rgba(0,0,0,0.2)]",
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & { size?: SwitchSize }
>(({ className, size = "default", ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex shrink-0 cursor-pointer items-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      TRACK[size],
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block bg-background ring-0 transition-transform data-[state=unchecked]:translate-x-0",
        THUMB[size]
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
