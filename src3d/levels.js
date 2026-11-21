// 3D levels. layers[z] = rows of y, chars of x. Bottom layer FIRST.
//   .  air        ^ hot vent (boils to gas → rises)   v cold vent (gas condenses → falls)
//   #  warm block c cold block   h hot block   = grate (solids stand, liquid/gas pass)
//   X  crucible (2)   B crate   S Sol   C Cryo
// Run tools/solve3d.html after editing.

export const LEVELS = [
  {
    name: 'Sandbox: Vents',
    intro: 'Hot vents boil anything into gas and carry it up. Cold vents condense it back down. Liquid drips through grates; solids stand on them.',
    heat: 40, mass: 40,
    layers: [
      [ // z0: ground
        '######',
        '######',
        '######',
        '######',
        '######',
        '######',
      ],
      [ // z1: lower room
        '......',
        '.S..C.',
        '......',
        '...^..',
        '......',
        '......',
      ],
      [ // z2: upper floor — grate over the vent, a drip grate, a drop hole, the crucible
        '###=##',
        '######',
        '#X####',
        '#X#=##',
        '######',
        '.#####',
      ],
      [ // z3: upper room — cold vent to condense
        '......',
        '.....v',
        '......',
        '......',
        '......',
        '......',
      ],
    ],
  },
  {
    name: 'Sandbox: Stack',
    intro: 'Push the crate into the pit to make a bridge. Standing on Cryo freezes Sol; standing on Sol boils Cryo.',
    heat: 20, mass: 20,
    layers: [
      [ // z0: ground
        '######',
        '######',
        '######',
      ],
      [ // z1: floor with a crate pit and a small pocket pit
        '##.###',
        '###.XX',
        '######',
      ],
      [ // z2: walking level
        '...###',
        '.SB...',
        '.C.###',
      ],
    ],
  },
];
