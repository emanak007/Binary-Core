// Level legend
//   W wall   . warm floor   c cold floor   h hot floor
//   # grate (liquid/gas only)   _ gap (gas only — anything else falls)
//   X crucible (2 tiles; both elements must stand on it at once)
//   S Sol start   C Cryo start   B pushable block (solid only; fills gaps)
//
// heat = turns before the Crucible goes cold
// mass = how long each element survives apart (gas burns 2/turn, adjacent = no loss)
// Run tools/solve.html after editing to confirm every level is still solvable.

export const LEVELS = [
  {
    name: 'Ignition',
    intro: 'Core fracture detected. Both elements respond to the same command. Guide them into the Crucible together.',
    heat: 16, mass: 16,
    map: [
      'WWWWWWWWWW',
      'W........W',
      'W.S......W',
      'W........W',
      'W....C...W',
      'W........W',
      'W...XX...W',
      'WWWWWWWWWW',
    ],
  },
  {
    name: 'Coolant Grate',
    intro: 'Grates block solids. Cryo flows through as liquid on warm floor. Sol must be melted on hot plating.',
    heat: 18, mass: 18,
    map: [
      'WWWWWWWWWWW',
      'W...h#....W',
      'W.S..#....W',
      'W....#.XX.W',
      'W.C..#....W',
      'W....#....W',
      'WWWWWWWWWWW',
    ],
  },
  {
    name: 'Fracture Line',
    intro: 'Hull breach. Only a gas can cross open space. Heat Cryo until it boils, but keep Sol away from the edge.',
    heat: 22, mass: 20,
    map: [
      'WWWWWWWWWWWW',
      'W....h_....W',
      'W..C.h_....W',
      'WWWWWW_..XXW',
      'W.S..._....W',
      'W....._....W',
      'W..........W',
      'WWWWWWWWWWWW',
    ],
  },
  {
    name: 'Cold Storage',
    intro: 'Sol freezes solid in the cold and cannot move. Cryo hardens in the cold and can push what Sol cannot.',
    heat: 28, mass: 26,
    map: [
      'WWWWWWWWWWWW',
      'W........WWW',
      'W.S..cccc_XW',
      'W....cBcc_XW',
      'W.C..cccc_WW',
      'W........WWW',
      'WWWWWWWWWWWW',
    ],
  },
  {
    name: 'Binary Core',
    intro: 'Final chamber. Core integrity critical. Stay close to share heat; you will not survive apart.',
    heat: 22, mass: 16,
    map: [
      'WWWWWWWWWWWWW',
      'W.....W.....W',
      'W.S..h#..B..W',
      'W.....W.....W',
      'W.C..hW_____W',
      'W.....#...W.W',
      'W.....W..XX.W',
      'WWWWWWWWWWWWW',
    ],
  },
];
