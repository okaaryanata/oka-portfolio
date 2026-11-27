import { useEffect, useRef, useState } from 'react';
import { findPath } from '../algorithms/core';
import { presetWalls } from './preset';
export function Maze() {
  const [walls, setWalls] = useState(presetWalls),
    [start, setStart] = useState(15),
    [finish, setFinish] = useState(133),
    [tool, setTool] = useState('wall'),
    [visited, setVisited] = useState(new Set<number>()),
    [path, setPath] = useState(new Set<number>()),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState('Preset loaded. Select Run BFS and A* to compare.');
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  function reset(message: string) {
    generation.current++;
    setBusy(false);
    setVisited(new Set());
    setPath(new Set());
    setStatus(message);
  }
  async function compare() {
    const run = ++generation.current;
    setBusy(true);
    const config = { width: 15, height: 9, start, finish, walls };
    const results = [
      { name: 'BFS', ...findPath(config) },
      { name: 'A*', ...findPath(config, true) },
    ];
    for (const result of results) {
      setStatus(`Showing ${result.name}…`);
      const explored = new Set<number>();
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
        for (const cell of result.visited) {
          if (run !== generation.current) return;
          explored.add(cell);
          setVisited(new Set(explored));
          setPath(new Set());
          await new Promise((resolve) => setTimeout(resolve, 12));
        }
      if (run !== generation.current) return;
      setVisited(new Set(result.visited));
      setPath(new Set(result.path));
      if (result.name === 'BFS' && !matchMedia('(prefers-reduced-motion: reduce)').matches)
        await new Promise((resolve) => setTimeout(resolve, 500));
      if (run !== generation.current) return;
    }
    setStatus(
      results
        .map(
          (r) =>
            `${r.name}: ${r.path.length ? `${r.path.length - 1} moves` : 'no route'}, ${r.visited.length} cells explored`,
        )
        .join('. ') + '.',
    );
    setBusy(false);
  }
  return (
    <>
      <div className="controls">
        <label>
          Grid tool
          <select value={tool} onChange={(e) => setTool(e.target.value)}>
            <option value="wall">Toggle wall</option>
            <option value="start">Move start</option>
            <option value="finish">Move finish</option>
          </select>
        </label>
        <button
          className="button"
          onClick={() => {
            setWalls(presetWalls());
            setStart(15);
            setFinish(133);
            reset('Preset loaded.');
          }}
        >
          Load preset
        </button>
        <button
          className="button"
          onClick={() => {
            setWalls(new Set());
            reset('Walls cleared.');
          }}
        >
          Clear walls
        </button>
        <button className="button primary" disabled={busy} onClick={() => void compare()}>
          Run BFS and A*
        </button>
        <button className="button" onClick={() => reset('Search stopped.')}>
          Stop
        </button>
      </div>
      <div className="legend">
        {['endpoint', 'wall', 'visited', 'path'].map((name, i) => (
          <span key={name}>
            <i className={name} />
            {['Start / finish', 'Wall', 'Explored', 'Route'][i]}
          </span>
        ))}
      </div>
      <div className="maze-grid" aria-label="Editable maze. Choose a tool, then select cells.">
        {Array.from({ length: 135 }, (_, i) => {
          const state =
            i === start
              ? 'Start'
              : i === finish
                ? 'Finish'
                : walls.has(i)
                  ? 'Wall'
                  : path.has(i)
                    ? 'Route'
                    : visited.has(i)
                      ? 'Explored'
                      : 'Open';
          return (
            <button
              key={i}
              type="button"
              aria-label={`${state}, row ${Math.floor(i / 15) + 1}, column ${(i % 15) + 1}`}
              className={
                i === start || i === finish
                  ? 'endpoint'
                  : walls.has(i)
                    ? 'wall'
                    : path.has(i)
                      ? 'path'
                      : visited.has(i)
                        ? 'visited'
                        : ''
              }
              onClick={() => {
                if (i === start || i === finish) return;
                const next = new Set(walls);
                if (tool === 'wall') {
                  if (!next.delete(i)) next.add(i);
                } else {
                  next.delete(i);
                  if (tool === 'start') setStart(i);
                  else setFinish(i);
                }
                setWalls(next);
                reset('Grid updated. Run the comparison.');
              }}
            >
              {i === start ? 'S' : i === finish ? 'F' : ''}
            </button>
          );
        })}
      </div>
      <p className="result" role="status">
        {status}
      </p>
    </>
  );
}
