/**
 * Whether a key event came from an enabled button. Global hotkeys on Enter/Space must ignore those events: the library calls
 * preventDefault for every match, which would stop a keyboard user from activating the focused button.
 */
export function isActivatableButton(target: EventTarget | null): boolean {
  return target instanceof HTMLButtonElement && !target.disabled
}
