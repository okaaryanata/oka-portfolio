import { test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Sudoku } from '../src/features/sudoku/Sudoku';
import { Queens } from '../src/features/queens/Queens';
import { Maze } from '../src/features/maze/Maze';
import { Booking } from '../src/features/booking/Booking';
import { ProjectGallery } from '../src/features/portfolio/ProjectGallery';
import { Contact } from '../src/features/portfolio/Contact';
import { Layout } from '../src/shared/ui/Layout';
import { CatViewer } from '../src/features/cats/CatViewer';
import { validateBoard, solveBoard, sample } from '../src/features/sudoku/model';
const solution =
  '534678912672195348198342567859761423426853791713924856961537284287419635345286179';
const solved = () =>
  Array.from({ length: 9 }, (_, r) => [...solution.slice(r * 9, r * 9 + 9)].map(Number));
test('all 81 Sudoku cells sanitize digits, select clues and navigate without crossing row edges', () => {
  render(<Sudoku />);
  fireEvent.click(screen.getByText('Clear'));
  const cells = screen.getAllByRole<HTMLInputElement>('textbox');
  expect(cells).toHaveLength(81);
  for (let i = 0; i < 81; i++) {
    const cell = cells[i];
    fireEvent.change(cell, { target: { value: 'x7!2' } });
    expect(cell.value).toBe('7');
    cell.focus();
    expect(cell.selectionEnd).toBe(1);
    const row = Math.floor(i / 9),
      col = i % 9;
    for (const [key, target] of [
      ['ArrowLeft', col ? i - 1 : i],
      ['ArrowRight', col < 8 ? i + 1 : i],
      ['ArrowUp', row ? i - 9 : i],
      ['ArrowDown', row < 8 ? i + 9 : i],
    ] as const) {
      cell.focus();
      fireEvent.keyDown(cell, { key });
      expect(document.activeElement).toBe(cells[target]);
    }
    fireEvent.change(cell, { target: { value: '0' } });
    expect(cell.value).toBe('');
  }
});
test.each(Array.from({ length: 9 }, (_, i) => i))(
  'Sudoku box %i rejects duplicates before a network request',
  (box) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    render(<Sudoku />);
    fireEvent.click(screen.getByText('Clear'));
    const cells = screen.getAllByRole('textbox'),
      top = Math.floor(box / 3) * 27 + (box % 3) * 3;
    for (const i of [top, top + 10]) fireEvent.change(cells[i], { target: { value: '7' } });
    fireEvent.click(screen.getByText('Solve puzzle'));
    expect(screen.getByRole('status')).toHaveTextContent('3×3 box');
    expect(fetch).not.toHaveBeenCalled();
  },
);
test('Sudoku solves all nine boxes and restores the original clues', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ board: solved() }))),
  );
  render(<Sudoku />);
  const original = screen.getAllByRole<HTMLInputElement>('textbox').map((i) => i.value);
  fireEvent.click(screen.getByText('Solve puzzle'));
  await screen.findByText('Solved. Reset restores your clues.');
  expect(
    screen
      .getAllByRole<HTMLInputElement>('textbox')
      .map((i) => i.value)
      .join(''),
  ).toBe(solution);
  fireEvent.click(screen.getByText('Reset clues'));
  expect(screen.getAllByRole<HTMLInputElement>('textbox').map((i) => i.value)).toEqual(original);
});
test('Sudoku recovers from API failures and clear cancels a pending response', async () => {
  let finish: (response: Response) => void = () => {};
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'no solution' } }), { status: 422 }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      ),
  );
  render(<Sudoku />);
  fireEvent.click(screen.getByText('Solve puzzle'));
  await screen.findByText('no solution');
  expect(screen.getByText('Solve puzzle')).not.toBeDisabled();
  fireEvent.click(screen.getByText('Solve puzzle'));
  fireEvent.click(screen.getByText('Clear'));
  await act(async () => {
    finish(new Response(JSON.stringify({ board: solved() })));
    await Promise.resolve();
  });
  expect(screen.getAllByRole<HTMLInputElement>('textbox').every((i) => i.value === '')).toBe(true);
});
test('Sudoku validates malformed payloads and reports backend errors', async () => {
  for (const invalid of [
    null,
    {},
    [[0]],
    Array.from({ length: 9 }, () => Array<number>(9).fill(10)),
  ])
    expect(validateBoard(invalid)).not.toBe('');
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'unsolvable' } }), { status: 422 }),
      ),
  );
  await expect(
    solveBoard(
      Array.from({ length: 9 }, (_, r) => [...sample.slice(r * 9, r * 9 + 9)].map(Number)),
    ),
  ).rejects.toThrow('unsolvable');
});
test('8-Queens preserves 64 squares through completion and supports reset/size changes', async () => {
  const { container } = render(<Queens />);
  fireEvent.click(screen.getByText('Solve'));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Solution found'));
  expect(container.querySelectorAll('.square')).toHaveLength(64);
  expect(
    [...container.querySelectorAll('.square')].filter((s) => s.textContent === '♛'),
  ).toHaveLength(8);
  fireEvent.click(screen.getByText('Reset'));
  expect([...container.querySelectorAll('.square')].every((s) => !s.textContent)).toBe(true);
  fireEvent.change(screen.getByLabelText('Board size'), { target: { value: '4' } });
  expect(container.querySelectorAll('.square')).toHaveLength(16);
});
test('changing a maze cancels an active search without stale completion', async () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  vi.useFakeTimers();
  try {
    render(<Maze />);
    fireEvent.click(screen.getByText('Run BFS and A*'));
    fireEvent.click(screen.getByRole('button', { name: 'Open, row 1, column 1' }));
    await act(() => vi.runAllTimersAsync());
    expect(screen.getByRole('status')).toHaveTextContent('Grid updated');
    expect(screen.getByText('Run BFS and A*')).not.toBeDisabled();
  } finally {
    vi.useRealTimers();
  }
});
test('booking confirms the first arrival and reset cancels pending claims', async () => {
  vi.useFakeTimers();
  try {
    render(<Booking />);
    fireEvent.click(screen.getByText('Start race'));
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(screen.getByText('Customer B: Confirmed')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Reset'));
    await act(() => vi.runAllTimersAsync());
    expect(screen.queryByText(/Customer .*: /)).not.toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});
for (const narrow of [false, true])
  test(`all six gallery cards have the shared footer on ${narrow ? 'mobile' : 'desktop'}`, () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('900px') && narrow,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const { container } = render(<ProjectGallery />);
    const seen = new Set<string>();
    for (let page = 0; page < 6; page++) {
      const cards = container.querySelectorAll('.project');
      expect(cards).toHaveLength(narrow ? 1 : 2);
      for (const card of cards) {
        seen.add(card.querySelector('h3')!.textContent);
        expect(card.querySelector('.project-footer .actions')).not.toBeNull();
        expect(card.querySelector('.project-footer .status')).not.toBeNull();
      }
      const next = screen.getByLabelText('Next projects');
      if (next.hasAttribute('disabled')) break;
      fireEvent.click(next);
    }
    expect(seen.size).toBe(6);
    expect(screen.queryByText('Original solver')).not.toBeInTheDocument();
    expect(screen.queryByText('Original collection')).not.toBeInTheDocument();
  });
for (const theme of ['light', 'dark'])
  test(`email icon works in ${theme} theme`, async () => {
    document.documentElement.dataset.theme = theme;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<Contact />);
    fireEvent.click(screen.getByLabelText('Copy email address'));
    await screen.findByText('Email address copied.');
    expect(writeText).toHaveBeenCalledWith('okaaryanata@gmail.com');
    expect(screen.getByLabelText('Email copied. Copy again').querySelector('svg')).not.toBeNull();
  });
test('copy permission failure provides a manual fallback', async () => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
  });
  render(<Contact />);
  fireEvent.click(screen.getByLabelText('Copy email address'));
  await screen.findByText('Select and copy the email address above.');
});
test('theme toggle updates the page and saves the selection', () => {
  document.documentElement.dataset.theme = 'light';
  render(<Layout>Content</Layout>);
  fireEvent.click(screen.getByLabelText('Switch to dark mode'));
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(localStorage.getItem('oka-theme')).toBe('dark');
});
test('cat stop cancels an in-flight request and restores controls', async () => {
  let signal: AbortSignal | undefined;
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url: string, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          signal = options.signal as AbortSignal;
          signal.addEventListener('abort', () =>
            reject(new DOMException('cancelled', 'AbortError')),
          );
        }),
    ),
  );
  render(<CatViewer />);
  fireEvent.click(screen.getByText('Load cat GIF'));
  expect(screen.getByText('Load cat GIF')).toBeDisabled();
  fireEvent.click(screen.getByText('Stop animation'));
  await screen.findByText('Animation stopped.');
  expect(signal?.aborted).toBe(true);
  expect(screen.getByText('Load cat GIF')).not.toBeDisabled();
});
