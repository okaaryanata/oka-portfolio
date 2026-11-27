export function findPath(
  {
    width,
    height,
    start,
    finish,
    walls,
  }: { width: number; height: number; start: number; finish: number; walls: Set<number> },
  astar = false,
) {
  const queue = [{ cell: start, distance: 0 }],
    distances = new Map([[start, 0]]),
    parents = new Map<number, number>(),
    visited: number[] = [];
  const closed = new Set();
  const heuristic = (cell: number) =>
    Math.abs((cell % width) - (finish % width)) +
    Math.abs(Math.floor(cell / width) - Math.floor(finish / width));
  while (queue.length) {
    if (astar)
      queue.sort(
        (a, b) =>
          a.distance + heuristic(a.cell) - (b.distance + heuristic(b.cell)) ||
          heuristic(a.cell) - heuristic(b.cell),
      );
    const { cell, distance } = queue.shift()!;
    if (closed.has(cell)) continue;
    closed.add(cell);
    visited.push(cell);
    if (cell === finish) {
      const path = [finish];
      while (path.at(-1) !== start) path.push(parents.get(path.at(-1)!)!);
      return { visited, path: path.reverse() };
    }
    const row = Math.floor(cell / width),
      col = cell % width;
    const next = [];
    if (col > 0) next.push(cell - 1);
    if (col < width - 1) next.push(cell + 1);
    if (row > 0) next.push(cell - width);
    if (row < height - 1) next.push(cell + width);
    for (const neighbor of next) {
      if (walls.has(neighbor) || distance + 1 >= (distances.get(neighbor) ?? Infinity)) continue;
      distances.set(neighbor, distance + 1);
      parents.set(neighbor, cell);
      queue.push({ cell: neighbor, distance: distance + 1 });
    }
  }
  return { visited, path: [] };
}
export function* queenSteps(
  size: number,
  columns: number[] = [],
): Generator<number[], boolean, unknown> {
  if (columns.length === size) return true;
  const row = columns.length;
  for (let col = 0; col < size; col++) {
    if (
      columns.some((previous, rank) => previous === col || Math.abs(previous - col) === row - rank)
    )
      continue;
    columns.push(col);
    yield [...columns];
    if (yield* queenSteps(size, columns)) return true;
    columns.pop();
    yield [...columns];
  }
  return false;
}
export function createSlot() {
  let owner: string | null = null;
  return (customer: string) => {
    if (owner !== null) return { confirmed: false, owner };
    owner = customer;
    return { confirmed: true, owner };
  };
}
