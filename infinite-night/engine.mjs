// Simulation indépendante du DOM et du rendu Canvas.
export const UPGRADES = [
  ['Cœur de grenat', 'PV max +25, soigne 25 PV.', s => { s.maxHp += 25; s.hp = Math.min(s.maxHp, s.hp + 25); }],
  ['Lame affûtée', 'Dégâts +25%.', s => { s.damage *= 1.25; }],
  ['Bottes lunaires', 'Vitesse +12%.', s => { s.speed *= 1.12; }],
  ['Tome des brumes', 'Cadence de tir +20%.', s => { s.rate *= .8; }],
  ['Manteau d’ombre', 'Réduit les dégâts reçus de 15%.', s => { s.armor = Math.min(.6, s.armor + .15); }],
  ['Orbe vorace', 'Portée de ramassage +35%.', s => { s.magnet *= 1.35; }],
  ['Sceaux orbitaux', 'Runes qui blessent les ennemis proches.', s => { s.orbitLevel = Math.min(5, s.orbitLevel + 1); }],
  ['Braises en chaîne', 'Explosion automatique sur un ennemi proche.', s => { s.emberLevel = Math.min(6, s.emberLevel + 1); }],
  ['Cloche funèbre', 'Onde de zone qui frappe les ombres proches.', s => { s.bellLevel = Math.min(5, s.bellLevel + 1); }],
  ['Sceau sanguin', 'Récupère des PV à chaque élimination.', s => { s.bloodLevel = Math.min(5, s.bloodLevel + 1); }]
];
export const SPAWN_PROFILES = {
  classic: {initialInterval: .8, minimumInterval: .16},
  eased: {initialInterval: .9, minimumInterval: .2}
};

export function getUpgradeChoices(state, count = 3) {
  const available = UPGRADES.filter((_, index) =>
    !(index === 6 && state.orbitLevel >= 5) &&
    !(index === 7 && state.emberLevel >= 6) &&
    !(index === 8 && state.bellLevel >= 5) &&
    !(index === 9 && state.bloodLevel >= 5)
  );
  const random = state.upgradeRandom || state.random;
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  return available.slice(0, Math.max(0, count));
}

export function createSeededRandom(seed) {
  let value = Number(seed) >>> 0;
  if (value === 0) value = 0x6d2b79f5;
  return function random() {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
}

export function createRun({ random = Math.random, upgradeRandom = random } = {}) {
  return {
    x: 0, y: 0, hp: 100, maxHp: 100, damage: 22, speed: 205, rate: .8,
    armor: 0, magnet: 85, level: 1, xp: 0, need: 6, kills: 0, elapsed: 0,
    shots: [], enemies: [], gems: [], spawn: 0, fire: 0, orbitLevel: 0,
    emberLevel: 0, bellLevel: 0, bloodLevel: 0, orbitAngle: 0,
    emberCooldown: 0, bellCooldown: 0, paused: false, dead: false,
    random, upgradeRandom
  };
}

// Retourne null, 'level-up' ou 'death'. Le navigateur décide ensuite de l'UI et du stockage.
export function updateRun(s, dt, input, viewport, spawnProfile = SPAWN_PROFILES.eased) {
  s.elapsed += dt;
  const dx = input.x, dy = input.y, len = Math.hypot(dx, dy) || 1;
  s.x += dx / len * s.speed * dt;
  s.y += dy / len * s.speed * dt;
  const mins = s.elapsed / 60, difficulty = 1 + Math.log1p(mins) * .20;
  s.spawn -= dt;
  if (s.spawn <= 0 && s.enemies.length < Math.min(210, 22 + mins * 1.15)) {
    const angle = s.random() * Math.PI * 2;
    // viewport est exprimé en pixels CSS (unités de simulation), pas en pixels Canvas DPR.
    const radius = Math.max(viewport.width, viewport.height) / 2 + 60;
    const eliteChance = Math.min(.28, mins * .018);
    const eliteSize = s.random() < eliteChance;
    const elite = s.random() < eliteChance;
    const hp = (32 + mins * 2.3) * difficulty;
    s.enemies.push({
      x: s.x + Math.cos(angle) * radius, y: s.y + Math.sin(angle) * radius,
      hp, max: hp, spd: (35 + mins * .45) * Math.min(1.4, difficulty),
      dmg: 7 * difficulty, r: eliteSize ? 15 : 10, elite
    });
    s.spawn = Math.max(spawnProfile.minimumInterval, spawnProfile.initialInterval - mins * .012);
  }
  s.fire -= dt;
  if (s.fire <= 0 && s.enemies.length) {
    const target = s.enemies.reduce((a, b) => !a || Math.hypot(b.x - s.x, b.y - s.y) < Math.hypot(a.x - s.x, a.y - s.y) ? b : a, null);
    s.shots.length = 0;
    s.shots.push({ x: s.x, y: s.y, tx: target.x, ty: target.y, life: .2 });
    target.hp -= s.damage;
    s.fire = s.rate;
  }
  s.orbitAngle += dt * (1.6 + s.orbitLevel * .08);
  if (s.orbitLevel) {
    const count = s.orbitLevel >= 5 ? 6 : s.orbitLevel;
    for (let i = 0; i < count; i++) {
      const angle = s.orbitAngle + i * Math.PI * 2 / count;
      const ox = s.x + Math.cos(angle) * 58, oy = s.y + Math.sin(angle) * 58;
      for (const e of s.enemies) if (Math.hypot(e.x - ox, e.y - oy) < e.r + 8) {
        if ((e.orbitCooldown || 0) <= 0) { e.hp -= s.damage * (s.orbitLevel >= 5 ? 1.15 : .48); e.orbitCooldown = .45; }
      }
    }
  }
  s.emberCooldown -= dt;
  if (s.emberLevel && s.emberCooldown <= 0 && s.enemies.length) {
    let target = null, dist = 350;
    for (const e of s.enemies) { const d = Math.hypot(e.x - s.x, e.y - s.y); if (d < dist) { dist = d; target = e; } }
    if (target) {
      const radius = 42 + s.emberLevel * 7, damage = s.damage * (.9 + s.emberLevel * .22);
      for (const e of s.enemies) if (Math.hypot(e.x - target.x, e.y - target.y) < radius + e.r) e.hp -= damage;
      s.emberCooldown = Math.max(.75, 3.3 - s.emberLevel * .35);
    }
  }
  s.bellCooldown -= dt;
  if (s.bellLevel && s.bellCooldown <= 0 && s.enemies.length) {
    const radius = 82 + s.bellLevel * 12;
    let hit = false;
    for (const e of s.enemies) if (Math.hypot(e.x - s.x, e.y - s.y) < radius + e.r) {
      e.hp -= s.damage * (.45 + s.bellLevel * .13);
      hit = true;
    }
    if (hit) s.bellCooldown = Math.max(2.4, 5 - s.bellLevel * .5);
  }
  for (const e of s.enemies) {
    e.orbitCooldown = Math.max(0, (e.orbitCooldown || 0) - dt);
    const ax = s.x - e.x, ay = s.y - e.y, distance = Math.hypot(ax, ay) || 1;
    e.x += ax / distance * e.spd * dt;
    e.y += ay / distance * e.spd * dt;
    if (distance < e.r + 12) {
      e.cool = (e.cool || 0) - dt;
      if (e.cool <= 0) { s.hp -= Math.max(1, e.dmg * (1 - s.armor)); e.cool = .65; }
    }
  }
  for (let i = s.enemies.length - 1; i >= 0; i--) if (s.enemies[i].hp <= 0) {
    const e = s.enemies.splice(i, 1)[0];
    s.kills++;
    if (s.bloodLevel && s.hp > 0) s.hp = Math.min(s.maxHp, s.hp + .2 * s.bloodLevel);
    s.gems.push({ x: e.x, y: e.y, value: e.elite ? 3 : 1 });
  }
  for (let i = s.gems.length - 1; i >= 0; i--) {
    const g = s.gems[i], distance = Math.hypot(g.x - s.x, g.y - s.y);
    if (distance < s.magnet) { g.x += (s.x - g.x) * Math.min(1, dt * 5); g.y += (s.y - g.y) * Math.min(1, dt * 5); }
    if (distance < 17) {
      s.xp += g.value;
      s.gems.splice(i, 1);
      if (s.xp >= s.need) {
        s.xp -= s.need; s.level++; s.need = Math.floor(s.need * 1.22 + 2); s.paused = true;
        return 'level-up';
      }
    }
  }
  if (s.hp <= 0) { s.hp = 0; s.dead = true; return 'death'; }
  return null;
}
