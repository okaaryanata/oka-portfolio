export function presetWalls() {
  const walls = new Set<number>();
  for (const [col, gap] of [
    [3, 7],
    [7, 2],
    [11, 6],
  ])
    for (let row = 0; row < 9; row++) if (row !== gap) walls.add(row * 15 + col);
  return walls;
}
