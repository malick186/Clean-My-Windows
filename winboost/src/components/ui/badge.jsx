import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-accent/12 text-accent border border-accent/20",
        success: "bg-green/12 text-green border border-green/20",
        warning: "bg-orange/12 text-orange border border-orange/20",
        danger: "bg-red/12 text-red border border-red/20",
        purple: "bg-purple/12 text-purple border border-purple/20",
        teal: "bg-teal/12 text-teal border border-teal/20",
        outline: "border border-border text-text-secondary",
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
