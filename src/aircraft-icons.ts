const straightPlane = 'M24 7 Q26 8 26 13 L26 20 L42 22 L42 26 L26 25 L25.5 35 L31 38 L31 40 L24 39 L17 40 L17 38 L22.5 35 L22 25 L6 26 L6 22 L22 20 L22 13 Q22 8 24 7 Z';
const tiltrotor = 'M24 7 Q27 10 26 19 L38 20 L38 23 L26 23 L25 35 L31 39 L31 41 L24 39 L17 41 L17 39 L23 35 L22 23 L10 23 L10 20 L22 19 Q21 10 24 7 Z';
const wingRotors = 'M4 16 L16 28 M4 28 L16 16 M32 16 L44 28 M32 28 L44 16';

function floatHull(centerX: number, noseY: number, width: number, length: number): string {
  const left = centerX - width / 2;
  const right = centerX + width / 2;
  const sternY = noseY + length;
  return `M${centerX} ${noseY} Q${right} ${noseY + 2} ${right} ${noseY + 4} L${centerX + width / 3} ${sternY} H${centerX - width / 3} L${left} ${noseY + 4} Q${left} ${noseY + 2} ${centerX} ${noseY} Z`;
}

const floats = floatHull(15, 14, 3, 20) + floatHull(33, 14, 3, 20);
const tiltAircraftIcon = { body: tiltrotor, detail: wingRotors };
export const aircraftIcons = [
  {
    category: 'Landplane',
    body: straightPlane,
    detail: 'M18 7 H30',
  },
  {
    category: 'Helicopter',
    body: 'M24 8 C29 8 30 15 29 21 Q28 25 26 26 L25 39 L28 39 L28 41 L23 41 L23 38 L22 26 Q19 25 19 21 C18 15 19 8 24 8 Z',
    detail: 'M8 10 L40 28 M8 28 L40 10',
  },
  {
    category: 'Seaplane',
    body: straightPlane + floats,
    detail: '',
  },
  {
    category: 'Amphibian',
    body: 'M24 5 Q28 9 28 16 L27 20 L42 21 L42 24 L27 24 L26 33 L25 36 L31 39 V41 L24 39 L17 41 V39 L23 36 L22 33 L21 24 L6 24 V21 L21 20 L20 16 Q20 9 24 5 Z ' + floatHull(9, 18, 2, 9) + floatHull(39, 18, 2, 9),
    detail: '',
  },
  {
    category: 'Gyrocopter',
    body: 'M24 10 C31 10 31 23 27 26 L25 27 L25 35 L30 38 L30 40 L24 39 L18 40 L18 38 L23 35 L23 27 L21 26 C17 23 17 10 24 10 Z',
    detail: 'M6 17 H42 M18 29 H30',
  },
  {
    category: 'Tiltrotor',
    ...tiltAircraftIcon,
  },
  {
    category: 'Tiltwing',
    ...tiltAircraftIcon,
  },
];
