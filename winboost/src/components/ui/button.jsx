import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-accent text-white shadow-sm hover:brightness-110 active:scale-[0.98]",
        secondary: "bg-surface-secondary text-text-secondary border border-border hover:bg-surface-hover hover:text-text active:scale-[0.98]",
        ghost: "text-text-secondary hover:bg-surface-secondary hover:text-text",
        danger: "bg-red/12 text-red hover:bg-red/18 active:scale-[0.98]",
        outline: "border border-border text-text-secondary hover:bg-surface-secondary hover:text-text active:scale-[0.98]",
        link: "text-accent underline-offset-4 hover:underline",
        gradient: "bg-gradient-to-r from-accent via-purple to-accent bg-[length:200%] text-white shadow-md hover:shadow-lg hover:bg-right active:scale-[0.98] transition-all duration-300",
      },
      size: {
        sm: "h-8 px-3.5 text-xs rounded-xl",
        default: "h-10 px-5 text-sm",
        lg: "h-12 px-7 text-base rounded-2xl",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
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
