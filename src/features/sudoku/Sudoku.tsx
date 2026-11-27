import { useEffect, useRef, useState } from 'react';
import { sample, solveBoard, validateBoard } from './model';
import { errorMessage } from '../../shared/api';
const sampleCells = () => [...sample].map((c) => (c === '0' ? '' : c));
export function Sudoku({ preview = false }: { preview?: boolean }) {
  const [cells, setCells] = useState(sampleCells);
  const [filled, setFilled] = useState<boolean[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Ready. Edit the board or solve this puzzle.');
  const original = useRef(sampleCells());
  const run = useRef(0);
  useEffect(
    () => () => {
      run.current++;
    },
    [],
  );
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  function reset(values: string[]) {
    run.current++;
    setCells([...values]);
    original.current = [...values];
    setBusy(false);
    setFilled([]);
    setStatus('Ready. Edit the board or solve this puzzle.');
  }
  async function solve() {
    const board = Array.from({ length: 9 }, (_, r) => cells.slice(r * 9, r * 9 + 9).map(Number));
    const problem = validateBoard(board);
    if (problem) {
      setStatus(problem);
      return;
    }
    original.current = [...cells];
    const current = ++run.current;
    setBusy(true);
    setStatus('Solving…');
    try {
      const result = await solveBoard(board);
      if (current !== run.current) return;
      setCells(result.flat().map(String));
      setFilled(cells.map((c) => !c));
      setStatus('Solved. Reset restores your clues.');
    } catch (error) {
      if (current === run.current) setStatus(errorMessage(error));
    } finally {
      if (current === run.current) setBusy(false);
    }
  }
  if (preview)
    return (
      <div id="board" aria-hidden="true">
        {cells.map((value, i) => (
          <span key={i} className={filled[i] ? 'filled' : ''}>
            {value}
          </span>
        ))}
      </div>
    );
  return (
    <div id="sudoku-app">
      <div className="controls">
        <button className="button" onClick={() => reset(sampleCells())}>
          Load sample
        </button>
        <button className="button" onClick={() => reset(Array<string>(81).fill(''))}>
          Clear
        </button>
        <button className="button primary" disabled={busy} onClick={() => void solve()}>
          Solve puzzle
        </button>
        <button className="button" onClick={() => reset(original.current)}>
          Reset clues
        </button>
      </div>
      <div className="sudoku-editor" aria-label="Editable Sudoku board" aria-busy={busy}>
        {cells.map((value, index) => (
          <input
            key={index}
            ref={(node) => {
              inputs.current[index] = node;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            autoComplete="off"
            aria-label={`Row ${Math.floor(index / 9) + 1}, column ${(index % 9) + 1}`}
            value={value}
            disabled={busy}
            className={filled[index] ? 'solved-cell' : ''}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              const next = [...cells];
              next[index] = e.target.value.replace(/[^1-9]/g, '').slice(0, 1);
              setCells(next);
              setFilled((current) => current.map((flag, i) => (i === index ? false : flag)));
            }}
            onKeyDown={(e) => {
              const row = Math.floor(index / 9),
                col = index % 9;
              const next: Record<string, number> = {
                ArrowLeft: col ? index - 1 : index,
                ArrowRight: col < 8 ? index + 1 : index,
                ArrowUp: row ? index - 9 : index,
                ArrowDown: row < 8 ? index + 9 : index,
              };
              if (e.key in next) {
                e.preventDefault();
                inputs.current[next[e.key]]?.focus();
              }
            }}
          />
        ))}
      </div>
      <p className="result" role="status">
        {status}
      </p>
    </div>
  );
}
