import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

interface BarcodeSvgProps {
  value: string
  format?: 'CODE128' | 'CODE39' | 'EAN13' | 'UPC'
  width?: number
  height?: number
  displayValue?: boolean
  fontSize?: number
  text?: string
  className?: string
  background?: string
  lineColor?: string
}

export function BarcodeSvg({
  value,
  format = 'CODE128',
  width = 2,
  height = 56,
  displayValue = true,
  fontSize = 13,
  text,
  className = '',
  background = '#ffffff',
  lineColor = '#000000',
}: BarcodeSvgProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)

  useEffect(() => {
    if (!svgRef.current || !value) return

    try {
      JsBarcode(svgRef.current, value, {
        format,
        width,
        height,
        displayValue,
        text: text ?? value,
        font: 'monospace',
        fontOptions: 'bold',
        fontSize,
        textMargin: 4,
        margin: 10,
        background,
        lineColor,
      })
    } catch (err) {
      console.warn('JsBarcode rendering error:', err)
    }
  }, [value, format, width, height, displayValue, fontSize, text, background, lineColor])

  return (
    <div className={`inline-block overflow-hidden rounded-lg bg-white p-1 shadow-xs border border-zinc-200 ${className}`}>
      <svg ref={svgRef} className="max-w-full h-auto block" />
    </div>
  )
}
