/** Whether the router has an earlier entry of this app to go back to. React Router stores its position as `idx` in history.state, which survives `replace` redirects (unlike `location.key`). */
export function canGoBack(): boolean {
  const idx = (window.history.state as { idx?: unknown } | null)?.idx
  return typeof idx === 'number' && idx > 0
}
