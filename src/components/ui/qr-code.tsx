import qrcode from 'qrcode-generator'

/**
 * Drawn as one SVG path of square modules rather than a canvas, so it stays
 * sharp at any size and needs no effect to paint itself.
 *
 * Fixed black on white in both themes. A scanner reads contrast, not taste,
 * and a code tinted to match the page is a code that fails in dim light.
 */
export function QrCode({ value, className }: { value: string; className?: string }) {
  const qr = qrcode(0, 'M')
  qr.addData(value)
  qr.make()

  const count = qr.getModuleCount()
  // One module of quiet zone each side. The spec asks for four; at the sizes
  // this is shown the surrounding white padding already supplies the rest.
  const size = count + 2

  let path = ''
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) path += `M${col + 1} ${row + 1}h1v1h-1z`
    }
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-hidden
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  )
}
