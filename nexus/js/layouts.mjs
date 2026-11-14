export function detectOrientation(win = window) {
  try {
    if (typeof win.matchMedia === 'function') {
      return win.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape';
    }
  } catch (_) {}
  return (win.innerHeight || 0) >= (win.innerWidth || 0) ? 'portrait' : 'landscape';
}

export function applyLayout(grid, layouts, orientation) {
  const layout = layouts?.[orientation];
  if (!grid || !layout) return false;
  const cards = new Map([...grid.querySelectorAll('[data-widget]')].map(card => [card.dataset.widget, card]));
  if (layout.order.length !== cards.size || layout.order.some(id => !cards.has(id))) return false;
  for (const id of layout.order) {
    const card = cards.get(id);
    card.hidden = !layout.widgets[id].visible;
    const maxColumns = orientation === 'landscape' ? 3 : 2;
    card.dataset.layoutSpan = String(Math.min(layout.widgets[id].span, maxColumns));
    card.dataset.layoutSize = layout.widgets[id].size || 'standard';
    grid.append(card);
  }
  grid.dataset.orientation = orientation;
  return true;
}

export function watchOrientation(callback, win = window) {
  let media;
  try { media = win.matchMedia?.('(orientation: portrait)'); } catch (_) {}
  if (media?.addEventListener) {
    const handleChange = () => callback(detectOrientation(win));
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }
  if (media?.addListener) {
    const handleChange = () => callback(detectOrientation(win));
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }
  const handleResize = () => callback(detectOrientation(win));
  win.addEventListener?.('resize', handleResize);
  return () => win.removeEventListener?.('resize', handleResize);
}
