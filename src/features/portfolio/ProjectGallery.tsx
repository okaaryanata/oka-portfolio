import { useEffect, useState } from 'react';
import { ProjectCard } from './ProjectCard';
import { findPath } from '../algorithms/core';
import { presetWalls } from '../maze/preset';
import { sample, solveBoard } from '../sudoku/model';
import { useCatGif } from '../cats/useCatGif';
import { errorMessage } from '../../shared/api';
const queenColumns = [0, 4, 7, 5, 2, 6, 1, 3];
const walls = presetWalls(),
  route = new Set(findPath({ width: 15, height: 9, start: 15, finish: 133, walls }, true).path);
function SimpleCard({ index }: { index: number }) {
  const data = [
    {
      category: 'Real-time messaging',
      title: 'IM Chat Demo',
      description:
        'Try two live clients, message actions, typing, and delivery receipts. Go, WebSockets, and SQLite.',
      href: 'chat-section',
      button: 'Try the chat demo',
      visual: (
        <div className="chat-preview-messages">
          <span>Demo A · Hello!</span>
          <span>Demo B · Hi there.</span>
        </div>
      ),
    },
    {
      category: 'Graph search',
      title: 'Maze & Pathfinding',
      description:
        'Draw walls, move the endpoints, and compare BFS and A* by route length and cells explored.',
      href: 'maze-section',
      button: 'Explore pathfinding',
      visual: (
        <div id="maze-preview" aria-hidden="true">
          {Array.from({ length: 135 }, (_, i) => (
            <span
              key={i}
              className={
                i === 15 || i === 133
                  ? 'endpoint'
                  : walls.has(i)
                    ? 'wall'
                    : route.has(i)
                      ? 'route'
                      : ''
              }
            />
          ))}
        </div>
      ),
    },
    {
      category: 'Backtracking',
      title: 'N-Queens Visualizer',
      description:
        'Watch queens find their place on a 4–8 square board, including every step back from a dead end.',
      href: 'queens-section',
      button: 'Try N-Queens',
      visual: (
        <div id="queens-preview" aria-hidden="true">
          {Array.from({ length: 64 }, (_, i) => (
            <span key={i} className={(Math.floor(i / 8) + (i % 8)) % 2 ? 'alt' : ''}>
              {queenColumns[Math.floor(i / 8)] === i % 8 ? '♛' : ''}
            </span>
          ))}
        </div>
      ),
    },
    {
      category: 'Concurrency concept',
      title: 'Booking Conflict Simulator',
      description:
        'Race two requests for a single slot. A browser simulation of a first-claim booking rule.',
      href: 'booking-section',
      button: 'Run the booking demo',
      visual: (
        <div className="booking-diagram">
          <div className="preview-slot">
            <span>10:00 appointment</span>
            <strong>One available slot</strong>
          </div>
          <div className="preview-requests">
            <div>
              <span>Customer A · 300 ms</span>
              <strong className="preview-conflict">Conflict</strong>
            </div>
            <div>
              <span>Customer B · 100 ms</span>
              <strong className="preview-confirmed">Confirmed</strong>
            </div>
          </div>
        </div>
      ),
    },
  ][index];
  return (
    <ProjectCard
      {...data}
      id={index === 0 ? 'im-chat' : undefined}
      actions={
        <a className="button" href={'projects.html#' + data.href}>
          {data.button}
        </a>
      }
    />
  );
}
function SudokuCard() {
  const [cells, setCells] = useState([...sample].map(Number)),
    [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false),
    [solved, setSolved] = useState(false);
  async function solve() {
    if (solved) {
      setCells([...sample].map(Number));
      setSolved(false);
      setStatus('Sample reset.');
      return;
    }
    setBusy(true);
    try {
      const result = await solveBoard(
        Array.from({ length: 9 }, (_, r) => cells.slice(r * 9, r * 9 + 9)),
      );
      setCells(result.flat());
      setSolved(true);
      setStatus('Sample solved.');
    } catch (e) {
      setStatus('Could not solve the sample. ' + errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <ProjectCard
      id="sudoku"
      category="Constraint solving"
      title="Sudoku Solver"
      description="Solve the sample puzzle here, or enter your own clues in the full solver."
      visual={
        <div id="board" aria-hidden="true">
          {cells.map((c, i) => (
            <span key={i} className={c && sample[i] === '0' ? 'filled' : ''}>
              {c || ''}
            </span>
          ))}
        </div>
      }
      actions={
        <>
          <button className="button" disabled={busy} onClick={() => void solve()}>
            {busy ? 'Solving…' : solved ? 'Reset sample' : 'Solve sample'}
          </button>
          <a href="projects.html#sudoku-section">Open full solver</a>
        </>
      }
      status={status}
    />
  );
}
function CatCard() {
  const cat = useCatGif();
  return (
    <ProjectCard
      id="cat-gifs"
      category="Just for fun"
      title="Cat GIFs"
      description="Enjoy a random cat GIF from CATAAS, or open the full GIF viewer."
      visual={
        <img
          src={cat.src}
          width={256}
          height={144}
          alt={
            cat.playing
              ? 'Random cat GIF'
              : 'Pixel-art orange cat lounging with its tail curled upward'
          }
        />
      }
      actions={
        <>
          <button
            className="button"
            disabled={cat.busy}
            aria-pressed={cat.playing}
            onClick={() => (cat.playing ? cat.stop() : void cat.load())}
          >
            {cat.playing ? 'Stop animation' : 'Load cat GIF'}
          </button>
          <button className="button" disabled={cat.busy} onClick={() => void cat.load()}>
            Another cat
          </button>
          <a href="projects.html#cats-section">Open GIF viewer</a>
        </>
      }
      status={cat.status}
    />
  );
}
export function ProjectGallery() {
  const [narrow, setNarrow] = useState(() => matchMedia('(max-width: 900px)').matches),
    [page, setPage] = useState(0);
  const count = narrow ? 1 : 2,
    pages = Math.ceil(6 / count);
  useEffect(() => {
    const media = matchMedia('(max-width: 900px)');
    const change = () => {
      setNarrow(media.matches);
      setPage(0);
    };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    const reveal = () => {
      const index =
        location.hash === '#cat-gifs'
          ? 5
          : location.hash === '#sudoku'
            ? 4
            : location.hash === '#im-chat'
              ? 0
              : -1;
      if (index >= 0) setPage(Math.floor(index / count));
    };
    reveal();
    window.addEventListener('hashchange', reveal);
    return () => window.removeEventListener('hashchange', reveal);
  }, [count]);
  const start = Math.min(page, pages - 1) * count;
  return (
    <section className="section" id="projects">
      <h2>Personal Projects</h2>
      <div
        className="project-carousel"
        role="region"
        aria-roledescription="carousel"
        aria-label="Personal projects"
      >
        <button
          className="carousel-arrow"
          id="projects-prev"
          aria-label="Previous projects"
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          ←
        </button>
        <div className="projects" id="project-cards">
          {Array.from({ length: count }, (_, offset) => {
            const index = start + offset;
            return index < 4 ? (
              <SimpleCard key={index} index={index} />
            ) : index === 4 ? (
              <SudokuCard key={index} />
            ) : (
              <CatCard key={index} />
            );
          })}
        </div>
        <button
          className="carousel-arrow"
          id="projects-next"
          aria-label="Next projects"
          disabled={page >= pages - 1}
          onClick={() => setPage((p) => p + 1)}
        >
          →
        </button>
      </div>
      <p className="carousel-status" role="status">
        Projects {start + 1}–{start + count} of 6
      </p>
    </section>
  );
}
