const z0 = ['.#####.', '.#####.', '.#####.', '.#####.', '.#####.', '.#####.', '.......'];
const mk = (name, z1, z2) => ({ name, heat: 99, mass: 99, layers: [z0, z1, z2], forbid: { ev: ['push'] }, trace: name.endsWith('*') });
const E = '.......';
const BACKNS = ['.###X#.', '.###X#.', E, '.#####.', '.#####.', '.#####.', E];
const BACKEW = ['.##XX#.', '.#####.', E, '.#####.', '.#####.', '.#####.', E];
export const LAB = [
  mk('Brink a', BACKNS, [E, E, E, '.....#.', '..B....', '..S.C..', E]),
  mk('Brink b', BACKNS, [E, E, E, '.#.....', '...B...', '..S.C..', E]),
  mk('Brink c*', BACKEW, [E, E, E, '.#...#.', '...B...', '..S.C..', E]),
  mk('Brink d', BACKNS, [E, E, E, '.#...#.', '..B....', '...SC..', E]),
  mk('Brink e', BACKEW, [E, E, E, '.....#.', '.B.....', '..S..C.', E]),
  mk('Brink f', BACKNS, [E, E, E, '.#...#.', '....B..', '..C.S..', E]),
];
