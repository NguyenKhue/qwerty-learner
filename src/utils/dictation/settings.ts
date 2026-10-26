/** Playback speeds offered in the dictation settings menu. */
export const DICTATION_SPEEDS = [0.5, 0.75, 1, 1.25] as const
export type DictationSpeed = (typeof DICTATION_SPEEDS)[number]

/** Turns whatever is stored for the playback speed into one the menu offers (normal speed otherwise). */
export function sanitizeSpeed(value: unknown): DictationSpeed {
  return (DICTATION_SPEEDS as readonly unknown[]).indexOf(value) !== -1 ? (value as DictationSpeed) : 1
}
