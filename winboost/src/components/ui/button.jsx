import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sparkle-primary/40 disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed active:scale-90 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-sparkle-primary text-white shadow-sm hover:brightness-110",
        secondary: "bg-sparkle-accent/50 text-sparkle-text hover:bg-sparkle-accent/70",
        outline: "border border-sparkle-border text-sparkle-text-secondary hover:bg-sparkle-accent/30",
        danger: "bg-sparkle-danger/10 text-sparkle-danger hover:bg-sparkle-danger/20",
        ghost: "text-sparkle-text-secondary hover:bg-sparkle-accent/50 hover:text-sparkle-text",
      },
      size: {
        sm: "h-7 px-3 text-xs",
        default: "h-9 px-4 text-sm",
        lg: "h-11 px-6 text-base rounded-xl",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
