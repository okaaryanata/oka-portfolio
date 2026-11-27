import { useEffect, useRef, useState } from 'react';
import { createSlot } from '../algorithms/core';
export function Booking() {
  const [delays, setDelays] = useState([300, 100]),
    [results, setResults] = useState<string[]>([]),
    [slot, setSlot] = useState('Available'),
    [busy, setBusy] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );
  function reset() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setResults([]);
    setSlot('Available');
    setBusy(false);
  }
  function race() {
    reset();
    setBusy(true);
    const claim = createSlot();
    let count = 0;
    for (const [i, ms] of delays.entries())
      timers.current.push(
        setTimeout(() => {
          const customer = `Customer ${i ? 'B' : 'A'}`,
            result = claim(customer);
          setResults((previous) => [
            ...previous,
            `${customer}: ${result.confirmed ? 'Confirmed' : 'Conflict — already claimed by ' + result.owner}`,
          ]);
          if (result.confirmed) setSlot('Confirmed for ' + customer);
          if (++count === 2) setBusy(false);
        }, ms),
      );
  }
  return (
    <>
      <form
        className="controls"
        onSubmit={(e) => {
          e.preventDefault();
          race();
        }}
      >
        {delays.map((delay, i) => (
          <label key={i}>
            Customer {i ? 'B' : 'A'} delay (ms)
            <input
              type="number"
              min="0"
              max="3000"
              value={delay}
              onChange={(e) =>
                setDelays((old) =>
                  old.map((v, index) =>
                    index === i ? Math.min(3000, Math.max(0, Number(e.target.value))) : v,
                  ),
                )
              }
            />
          </label>
        ))}
        <button className="button primary" disabled={busy}>
          Start race
        </button>
        <button className="button" type="button" onClick={reset}>
          Reset
        </button>
      </form>
      <div className="slot">
        <span>Demo appointment · 10:00</span>
        <strong>{slot}</strong>
      </div>
      <ol>
        {results.map((result, i) => (
          <li key={i}>{result}</li>
        ))}
      </ol>
      <p className="note">
        This is an in-memory browser simulation. JavaScript processes each claim sequentially. A
        production Go API needs a database transaction and a unique constraint on the resource and
        fixed time slot to enforce this across API instances. Nothing here creates a real booking.
      </p>
    </>
  );
}
