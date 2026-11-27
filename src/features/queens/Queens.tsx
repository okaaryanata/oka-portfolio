import { useEffect, useRef, useState } from 'react';
import { queenSteps } from '../algorithms/core';
export function Queens() {
  const [size, setSize] = useState(8),
    [columns, setColumns] = useState<number[]>([]),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState('Choose a board size and start the solver.');
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  function reset(next = size) {
    generation.current++;
    setSize(next);
    setColumns([]);
    setBusy(false);
    setStatus('Choose a board size and start the solver.');
  }
  async function solve() {
    const run = ++generation.current;
    setBusy(true);
    setColumns([]);
    setStatus('Solving…');
    let final: number[] = [],
      steps = 0;
    for (const positions of queenSteps(size)) {
      if (run !== generation.current) return;
      final = positions;
      steps++;
      setColumns(positions);
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
    if (run !== generation.current) return;
    setColumns(final);
    setBusy(false);
    setStatus(
      final.length === size
        ? `Solution found after ${steps} placement and backtracking steps.`
        : 'No solution found.',
    );
  }
  return (
    <>
      <div className="controls">
        <label>
          Board size
          <select
            aria-label="Board size"
            value={size}
            onChange={(e) => reset(Number(e.target.value))}
          >
            {[4, 5, 6, 7, 8].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <button className="button primary" disabled={busy} onClick={() => void solve()}>
          Solve
        </button>
        <button className="button" onClick={() => reset()}>
          Reset
        </button>
      </div>
      <div
        className="queens-grid"
        role="img"
        aria-busy={busy}
        aria-label={`${size} by ${size} chessboard. ${columns.map((col, row) => `Queen at row ${row + 1}, column ${col + 1}`).join('. ')}`}
        style={{
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: size * size }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={'square' + ((Math.floor(i / size) + (i % size)) % 2 ? ' alt' : '')}
          >
            {columns[Math.floor(i / size)] === i % size ? '♛' : ''}
          </span>
        ))}
      </div>
      <p className="result" role="status">
        {status}
      </p>
    </>
  );
}
