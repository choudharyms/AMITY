import { useEffect, useRef, useState } from "react"

interface CountUpProps {
  to: number
  from?: number
  duration?: number
  decimals?: number
  separator?: string
  className?: string
  suffix?: string
  prefix?: string
}

export function CountUp({
  to,
  from = 0,
  duration = 1.2,
  decimals = 0,
  separator = ",",
  className = "",
  suffix = "",
  prefix = "",
}: CountUpProps) {
  const [value, setValue] = useState(from)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let startTimestamp: number | null = null
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / (duration * 1000), 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = from + (to - from) * eased
      setValue(current)

      if (progress < 1) {
        window.requestAnimationFrame(step)
      } else {
        setValue(to)
      }
    }

    const rafId = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(rafId)
  }, [to, from, duration])

  const formatted = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString()
  const parts = formatted.split(".")
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, separator)
  const display = parts.join(".")

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display}
      {suffix}
    </span>
  )
}
