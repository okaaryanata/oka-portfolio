import {api} from './api.mjs';
export const sample = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
export function validateBoard(board) {
  if (!Array.isArray(board) || board.length !== 9 || board.some(row => !Array.isArray(row) || row.length !== 9 || row.some(value => !Number.isInteger(value) || value < 0 || value > 9))) return 'Use digits 1–9, or leave cells empty.';
  for (let row=0;row<9;row++) for(let col=0;col<9;col++) {
    const value=board[row][col]; if(!value) continue;
    for(let i=0;i<9;i++) if((i!==col && board[row][i]===value)||(i!==row && board[i][col]===value)) return 'The clues contain duplicate digits in a row or column.';
    const r=Math.floor(row/3)*3,c=Math.floor(col/3)*3;
    for(let y=r;y<r+3;y++) for(let x=c;x<c+3;x++) if((y!==row||x!==col)&&board[y][x]===value) return 'The clues contain duplicate digits in a 3×3 box.';
  }
  return '';
}
export async function solveBoard(board) { const problem=validateBoard(board); if(problem) throw new Error(problem); const result=await api('/sudoku/solve',{method:'POST',body:JSON.stringify({board})}); if(validateBoard(result.board)||result.board.flat().some(value=>!value)) throw new Error('The API returned an invalid solution.'); return result.board; }
export function mountSudoku(root) {
  const board=root.querySelector('.sudoku-editor'),status=root.querySelector('[role="status"]');
  let original,run=0;
  const cells=Array.from({length:81},(_,index)=>{
    const input=document.createElement('input');input.type='text';input.inputMode='numeric';input.maxLength=1;input.autocomplete='off';
    input.setAttribute('aria-label',`Row ${Math.floor(index/9)+1}, column ${index%9+1}`);
    input.addEventListener('input',()=>{input.value=input.value.replace(/[^1-9]/g,'').slice(0,1);input.classList.remove('solved-cell');});
    input.addEventListener('focus',()=>input.select());
    input.addEventListener('keydown',event=>{
      const row=Math.floor(index/9),col=index%9;
      const targets={ArrowLeft:col>0?index-1:index,ArrowRight:col<8?index+1:index,ArrowUp:row>0?index-9:index,ArrowDown:row<8?index+9:index};
      if(event.key in targets){event.preventDefault();cells[targets[event.key]].focus();}
    });
    board.append(input);return input;
  });
  const read=()=>Array.from({length:9},(_,row)=>cells.slice(row*9,row*9+9).map(cell=>Number(cell.value)||0));
  function fill(values){cells.forEach((cell,index)=>{cell.value=values.flat()[index]||'';cell.classList.remove('solved-cell');});}
  function reset(values){run++;fill(values);original=read();setBusy(false);status.textContent='Ready. Edit the board or solve this puzzle.';}
  function setBusy(busy){cells.forEach(cell=>cell.disabled=busy);root.querySelector('[data-action="solve"]').disabled=busy;board.setAttribute('aria-busy',String(busy));}
  root.querySelector('[data-action="sample"]').addEventListener('click',()=>reset(Array.from({length:9},(_,row)=>[...sample.slice(row*9,row*9+9)].map(Number))));
  root.querySelector('[data-action="clear"]').addEventListener('click',()=>reset(Array.from({length:9},()=>Array(9).fill(0))));
  root.querySelector('[data-action="reset"]').addEventListener('click',()=>reset(original));
  root.querySelector('[data-action="solve"]').addEventListener('click',async()=>{const input=read(),problem=validateBoard(input);if(problem){status.textContent=problem;return;}original=input;const current=++run;setBusy(true);status.textContent='Solving…';try{const result=await solveBoard(input);if(current!==run)return;fill(result);cells.forEach((cell,index)=>cell.classList.toggle('solved-cell',!input.flat()[index]));status.textContent='Solved. Reset restores your clues.';}catch(error){if(current===run)status.textContent=error.message;}finally{if(current===run)setBusy(false);}});
  root.querySelector('[data-action="sample"]').click();
}
