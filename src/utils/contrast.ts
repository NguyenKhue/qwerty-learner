export type Rgb = [number, number, number]

function channel(value: number): number {
  const s = value / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio between two colors, 1 to 21 */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

/** Reads `--name: R G B;` declarations from the first `selector { ... }` block of a stylesheet */
export function parseTokenBlock(css: string, selector: string): Record<string, Rgb> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const block = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css)
  const tokens: Record<string, Rgb> = {}
  if (!block) return tokens
  const declaration = /--([a-z-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g
  let match = declaration.exec(block[1])
  while (match) {
    tokens[match[1]] = [Number(match[2]), Number(match[3]), Number(match[4])]
    match = declaration.exec(block[1])
  }
  return tokens
}
