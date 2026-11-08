// Transforme un pointer position en direction bornée pour le joystick tactile.
export function joystickPosition(clientX, clientY, rect, deadzone = 7) {
  const limit = Math.min(rect.width, rect.height) * .29;
  if (!(limit > 0)) return {x: 0, y: 0, offsetX: 0, offsetY: 0, limit: 0};
  let offsetX = clientX - (rect.left + rect.width / 2);
  let offsetY = clientY - (rect.top + rect.height / 2);
  const length = Math.hypot(offsetX, offsetY);
  if (length > limit) { offsetX = offsetX / length * limit; offsetY = offsetY / length * limit; }
  if (length < deadzone) { offsetX = 0; offsetY = 0; }
  return {x: offsetX / limit, y: offsetY / limit, offsetX, offsetY, limit};
}
