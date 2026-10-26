const straightPlane = 'M24 7 Q26 8 26 13 L26 20 L42 22 L42 26 L26 25 L25.5 35 L31 38 L31 40 L24 39 L17 40 L17 38 L22.5 35 L22 25 L6 26 L6 22 L22 20 L22 13 Q22 8 24 7 Z';
const jet = 'M24 4 Q26.5 6 26.5 12 L26.5 20 L42 29 L42 32 L26 27 L25.5 36 L32 41 L32 43 L24 40 L16 43 L16 41 L22.5 36 L22 27 L6 32 L6 29 L21.5 20 L21.5 12 Q21.5 6 24 4 Z';
function propellerNacelle(centerX: number): string {
  return engineNacelle(centerX, 17);
}

function propellerBlade(centerX: number): string {
  return `M${centerX - 2.5} 16.5 H${centerX + 2.5}`;
}
const tiltrotor = 'M24 7 Q27 10 26 19 L38 20 L38 23 L26 23 L25 35 L31 39 L31 41 L24 39 L17 41 L17 39 L23 35 L22 23 L10 23 L10 20 L22 19 Q21 10 24 7 Z';
const wingRotors = 'M4 16 L16 28 M4 28 L16 16 M32 16 L44 28 M32 28 L44 16';

// Wing-mounted engines share one rounded nacelle shape; only placement changes.
function engineNacelle(centerX: number, frontY: number): string {
  return `M${centerX - 1.5} ${frontY + 1.5} Q${centerX} ${frontY - 1.5} ${centerX + 1.5} ${frontY + 1.5} V${frontY + 7} H${centerX - 1.5} Z`;
}

// Follow the wing sweep so every nacelle projects equally ahead of its wing.
function wingEngine(centerX: number): string {
  const distanceFromCenter = Math.abs(centerX - 24);
  const frontY = 18.5 + (distanceFromCenter - 8.5) * 9 / 15.5;
  return engineNacelle(centerX, frontY);
}

function floatHull(centerX: number, noseY: number, width: number, length: number): string {
  const left = centerX - width / 2;
  const right = centerX + width / 2;
  const sternY = noseY + length;
  return `M${centerX} ${noseY} Q${right} ${noseY + 2} ${right} ${noseY + 4} L${centerX + width / 3} ${sternY} H${centerX - width / 3} L${left} ${noseY + 4} Q${left} ${noseY + 2} ${centerX} ${noseY} Z`;
}

const floats = floatHull(15, 14, 3, 20) + floatHull(33, 14, 3, 20);
const twinJetEngines = wingEngine(15.5) + wingEngine(32.5);
const twinPropellerIcon = {
  body: straightPlane + [16, 32].map(propellerNacelle).join(''),
  detail: [16, 32].map(propellerBlade).join(''),
};
const tiltAircraftIcon = { body: tiltrotor, detail: wingRotors };

export const aircraftSymbols = {
  electric: { body: straightPlane + 'M40 3 L33 11 H38 L35 17 L44 8 H39 Z', detail: '' },
  singlePropeller: {
    body: straightPlane,
    detail: 'M18 7 H30',
  },
  twinJet: {
    body: jet + twinJetEngines,
    detail: '',
  },
  helicopter: {
    body: 'M24 8 C29 8 30 15 29 21 Q28 25 26 26 L25 39 L28 39 L28 41 L23 41 L23 38 L22 26 Q19 25 19 21 C18 15 19 8 24 8 Z',
    detail: 'M8 10 L40 28 M8 28 L40 10',
  },
  twinPropeller: twinPropellerIcon,
  water: {
    body: straightPlane + floats,
    detail: '',
  },
  gyrocopter: {
    body: 'M24 10 C31 10 31 23 27 26 L25 27 L25 35 L30 38 L30 40 L24 39 L18 40 L18 38 L23 35 L23 27 L21 26 C17 23 17 10 24 10 Z',
    detail: 'M6 17 H42 M18 29 H30',
  },
  tilt: tiltAircraftIcon,
  unknown: {
    body: 'M22.5 34 H25.5 V37 H22.5 Z',
    detail: 'M18 17 C18 9 31 9 31 17 C31 22 24 22 24 28',
  },
  landplane: { body: straightPlane, detail: '' },
};
