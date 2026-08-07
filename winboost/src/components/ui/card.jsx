import { cn } from "@/lib/utils"

function Card({ className, ...props }) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-3xl bg-surface/80 backdrop-blur-xl border border-white/[0.06] shadow-sm p-6 transition-all duration-300 hover:shadow-md hover:border-white/[0.1]",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex items-center gap-3 mb-5 pb-4 border-b border-white/[0.05]", className)}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }) {
  return (
    <h3
      data-slot="card-title"
      className={cn("text-base font-semibold text-text leading-none tracking-tight", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-xs text-text-tertiary mt-1", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }) {
  return <div data-slot="card-content" className={cn("", className)} {...props} />
}

function CardFooter({ className, ...props }) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-3 mt-5 pt-4 border-t border-white/[0.05]", className)}
      {...props}
    />
  )
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
