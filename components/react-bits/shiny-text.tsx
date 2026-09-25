import React from "react"
import { cn } from "cn"

interface ShinyTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode
  disabled?: boolean
  speed?: number
  className?: string
}

export function ShinyText({
  children,
  disabled = false,
  speed = 4,
  className = "",
  ...props
}: ShinyTextProps) {
  const animationDuration = `${speed}s`

  return (
    <span
      className={cn(
        "inline-block bg-clip-text text-transparent bg-gradient-to-r from-foreground via-primary to-foreground bg-[length:200%_100%]",
        !disabled && "animate-shiny-text",
        className
      )}
      style={{
        animationDuration,
      }}
      {...props}
    >
      {children}
    </span>
  )
}
