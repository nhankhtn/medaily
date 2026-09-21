/**
 * Enough colour maths to check a palette. The tokens are written in OKLCH, and
 * WCAG contrast is defined on sRGB, so a theme cannot be judged without the
 * conversion — and judging a theme by eye is how unreadable ones ship.
 */

export type Rgb = { r: number; g: number; b: number }

const OKLCH = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)$/

/**
 * Returns null for anything that is not a plain `oklch(L% C H)` colour.
 *
 * `alpha` is kept rather than dropped: every surface token in this app is
 * translucent, and a translucent token is not a colour until something is
 * painted under it. Reading `oklch(70% 0.03 260 / 0.1)` as an opaque 70% grey
 * says a dark panel is nearly white.
 */
export function parseOklch(value: string): {
  l: number
  c: number
  h: number
  alpha: number
} | null {
  const match = OKLCH.exec(value.trim())
  if (!match) return null

  return {
    l: Number(match[1]) / 100,
    c: Number(match[2]),
    h: Number(match[3]),
    alpha: match[4] === undefined ? 1 : Number(match[4]),
  }
}

/** `top` painted over `bottom` at `alpha`, both already gamma-encoded sRGB. */
export function composite(top: Rgb, bottom: Rgb, alpha: number): Rgb {
  return {
    r: top.r * alpha + bottom.r * (1 - alpha),
    g: top.g * alpha + bottom.g * (1 - alpha),
    b: top.b * alpha + bottom.b * (1 - alpha),
  }
}

/** OKLCH → linear sRGB → gamma-encoded sRGB, clipped to the gamut. */
export function oklchToRgb({ l, c, h }: { l: number; c: number; h: number }): Rgb {
  const radians = (h * Math.PI) / 180
  const a = c * Math.cos(radians)
  const b = c * Math.sin(radians)

  const lCone = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mCone = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const sCone = (l - 0.0894841775 * a - 1.291485548 * b) ** 3

  const linear = {
    r: 4.0767416621 * lCone - 3.3077115913 * mCone + 0.2309699292 * sCone,
    g: -1.2684380046 * lCone + 2.6097574011 * mCone - 0.3413193965 * sCone,
    b: -0.0041960863 * lCone - 0.7034186147 * mCone + 1.707614701 * sCone,
  }

  return {
    r: gamma(linear.r),
    g: gamma(linear.g),
    b: gamma(linear.b),
  }
}

const gamma = (channel: number): number => {
  const clipped = Math.min(1, Math.max(0, channel))
  return clipped <= 0.0031308 ? clipped * 12.92 : 1.055 * clipped ** (1 / 2.4) - 0.055
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  const linear = (channel: number) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4

  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** WCAG 2.1 contrast ratio, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05)
}

/**
 * Contrast of `a` on `b`. `base` is the opaque colour the whole stack sits on
 * — the theme's `--bg`. Without it a translucent `b` is measured as if it
 * were opaque, which is how an unreadable panel passes a palette test.
 */
export function contrastOf(a: string, b: string, base?: string): number | null {
  const front = parseOklch(a)
  const back = parseOklch(b)
  if (!front || !back) return null

  const under = base ? parseOklch(base) : null
  let backRgb = oklchToRgb(back)
  if (back.alpha < 1 && under) backRgb = composite(backRgb, oklchToRgb(under), back.alpha)

  let frontRgb = oklchToRgb(front)
  if (front.alpha < 1) frontRgb = composite(frontRgb, backRgb, front.alpha)

  return contrastRatio(frontRgb, backRgb)
}
