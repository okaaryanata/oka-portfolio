import { api } from '../../shared/api';
export const sample =
  '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
export function validateBoard(input: unknown): string {
  const board = input as number[][];
  if (
    !Array.isArray(board) ||
    board.length !== 9 ||
    board.some(
      (row) =>
        !Array.isArray(row) ||
        row.length !== 9 ||
        row.some((value) => !Number.isInteger(value) || value < 0 || value > 9),
    )
  )
    return 'Use digits 1–9, or leave cells empty.';
  for (let row = 0; row < 9; row++)
    for (let col = 0; col < 9; col++) {
      const value = board[row][col];
      if (!value) continue;
      for (let i = 0; i < 9; i++)
        if ((i !== col && board[row][i] === value) || (i !== row && board[i][col] === value))
          return 'The clues contain duplicate digits in a row or column.';
      const r = Math.floor(row / 3) * 3,
        c = Math.floor(col / 3) * 3;
      for (let y = r; y < r + 3; y++)
        for (let x = c; x < c + 3; x++)
          if ((y !== row || x !== col) && board[y][x] === value)
            return 'The clues contain duplicate digits in a 3×3 box.';
    }
  return '';
}
export async function solveBoard(board: number[][]) {
  const problem = validateBoard(board);
  if (problem) throw new Error(problem);
  const result = await api<{ board: number[][] }>('/sudoku/solve', {
    method: 'POST',
    body: JSON.stringify({ board }),
  });
  if (validateBoard(result.board) || result.board.flat().some((value) => !value))
    throw new Error('The API returned an invalid solution.');
  return result.board;
}
