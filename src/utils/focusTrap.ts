/** The index to focus on Tab (or Shift+Tab when `backwards`) so focus cycles inside a group of `count` elements. `current` is -1 when focus is outside the group. */
export function nextFocusIndex(current: number, count: number, backwards: boolean): number {
  if (count <= 0) return -1
  if (current < 0) return backwards ? count - 1 : 0
  return backwards ? (current - 1 + count) % count : (current + 1) % count
}
