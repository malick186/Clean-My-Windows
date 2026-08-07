import * as TooltipPrimitive from "@radix-ui/react-tooltip"

function TooltipProvider({ delayDuration = 300, ...props }) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />
}

function Tooltip({ ...props }) {
  return <TooltipPrimitive.Root {...props} />
}

function TooltipTrigger({ asChild = true, ...props }) {
  return <TooltipPrimitive.Trigger asChild={asChild} {...props} />
}

function TooltipContent({ className, sideOffset = 6, children, ...props }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={className}
        {...props}
      >
        <div className="tooltip-content">{children}</div>
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent }
