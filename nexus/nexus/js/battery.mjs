export async function initBatteryWidget({navigatorRef = navigator, documentRef = document} = {}) {
  const value = documentRef.getElementById('battery-value');
  const fill = documentRef.getElementById('battery-fill');
  const meter = documentRef.getElementById('battery-meter');
  const status = documentRef.getElementById('battery-status');
  const cleanups = [];

  const unavailable = message => {
    value.textContent = '—';
    fill.style.width = '0%';
    meter.removeAttribute('aria-valuenow');
    meter.setAttribute('aria-valuetext', message);
    status.textContent = message;
    return () => {};
  };

  if (typeof navigatorRef?.getBattery !== 'function') {
    return unavailable('Informations de batterie non prises en charge par ce navigateur.');
  }

  try {
    const battery = await navigatorRef.getBattery();
    const paint = () => {
      const level = Number(battery.level);
      if (!Number.isFinite(level) || level < 0 || level > 1) {
        unavailable('Le navigateur a renvoyé un niveau de batterie invalide.');
        return;
      }
      const percent = Math.round(level * 100);
      value.textContent = `${percent} %`;
      fill.style.width = `${percent}%`;
      meter.setAttribute('aria-valuenow', String(percent));
      const state = battery.charging ? 'En charge' : 'Sur batterie';
      meter.setAttribute('aria-valuetext', `${percent} %, ${state.toLowerCase()}`);
      status.textContent = state;
    };
    const add = (event, callback) => {
      battery.addEventListener(event, callback);
      cleanups.push(() => battery.removeEventListener(event, callback));
    };
    add('levelchange', paint);
    add('chargingchange', paint);
    paint();
    return () => cleanups.forEach(remove => remove());
  } catch (_) {
    return unavailable('Informations de batterie refusées ou indisponibles.');
  }
}
