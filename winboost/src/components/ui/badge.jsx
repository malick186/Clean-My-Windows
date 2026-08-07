import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.08em] px-2.5 py-0.5 transition-colors",
  {
    variants: {
      variant: {
        default: "bg-sparkle-primary/10 text-sparkle-primary border border-sparkle-primary/20",
        success: "bg-sparkle-success/10 text-sparkle-success border border-sparkle-success/20",
        warning: "bg-sparkle-warning/10 text-sparkle-warning border border-sparkle-warning/20",
        danger: "bg-sparkle-danger/10 text-sparkle-danger border border-sparkle-danger/20",
        purple: "bg-sparkle-purple/10 text-sparkle-purple border border-sparkle-purple/20",
        teal: "bg-sparkle-teal/10 text-sparkle-teal border border-sparkle-teal/20",
        pink: "bg-sparkle-pink/10 text-sparkle-pink border border-sparkle-pink/20",
        outline: "border border-sparkle-border text-sparkle-text-secondary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({ className, variant, ...props }) {
  return (
    <div data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
