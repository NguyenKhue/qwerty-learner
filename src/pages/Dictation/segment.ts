/** Seconds played before a sentence starts and after it ends, so its first and last words are not cut. */
const MARGIN = 0.3

/** The part of the video to play for a sentence, in seconds. */
export function segmentWindow(start: number, end: number): { from: number; to: number } {
  const round = (value: number) => Math.round(value * 1000) / 1000
  return { from: round(Math.max(0, start - MARGIN)), to: round(end + MARGIN) }
}

/** True once the player has reached the end of the window. */
export function shouldStop(currentTime: number, to: number): boolean {
  return currentTime >= to
}
