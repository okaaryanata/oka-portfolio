import {findPath, queenSteps, createSlot} from './algorithms.mjs';
import './theme.js';
const byId=id=>document.getElementById(id);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const width=15,height=9;
let start=15,finish=133,walls=new Set(),mazeRun=0;
const cells=Array.from({length:width*height},(_,index)=>{
  const cell=document.createElement('button');cell.type='button';
  cell.addEventListener('click',()=>{
    if(index===start||index===finish)return;
    const tool=byId('tool').value;
    if(tool==='wall'){if(!walls.delete(index))walls.add(index);}
    else {walls.delete(index);if(tool==='start')start=index;else finish=index;}
    resetMaze('Grid updated. Run the comparison.');
  });byId('maze').append(cell);return cell;
});
function drawMaze(visited=new Set(),path=new Set()) {
  cells.forEach((cell,index)=>{
    const endpoint=index===start||index===finish;
    cell.className=endpoint?'endpoint':walls.has(index)?'wall':path.has(index)?'path':visited.has(index)?'visited':'';
    cell.textContent=index===start?'S':index===finish?'F':'';
    const state=index===start?'Start':index===finish?'Finish':walls.has(index)?'Wall':path.has(index)?'Route':visited.has(index)?'Explored':'Open';
    cell.setAttribute('aria-label',`${state}, row ${Math.floor(index/width)+1}, column ${index%width+1}`);
  });
}
function resetMaze(message){mazeRun++;byId('compare').disabled=false;drawMaze();byId('maze-result').textContent=message;}
function preset(){start=15;finish=133;walls=new Set();for(const [col,gap] of [[3,7],[7,2],[11,6]])for(let row=0;row<height;row++)if(row!==gap)walls.add(row*width+col);resetMaze('Preset loaded. Select Run BFS and A* to compare.');}
byId('preset').addEventListener('click',preset);
byId('clear').addEventListener('click',()=>{walls.clear();resetMaze('Walls cleared.');});
byId('stop-maze').addEventListener('click',()=>resetMaze('Search stopped.'));
byId('compare').addEventListener('click',async()=>{
  const run=++mazeRun;byId('compare').disabled=true;
  const config={width,height,start,finish,walls};
  const results=[['BFS',findPath(config)],['A*',findPath(config,true)]];
  for(const [name,result] of results){
    byId('maze-result').textContent=`Showing ${name}…`;
    const explored=new Set();
    if(!reduced.matches)for(const cell of result.visited){if(run!==mazeRun)return;explored.add(cell);drawMaze(explored);await delay(12);}
    if(run!==mazeRun)return;
    drawMaze(new Set(result.visited),new Set(result.path));
    if(name==='BFS'&&!reduced.matches)await delay(500);
    if(run!==mazeRun)return;
  }
  byId('maze-result').textContent=results.map(([name,{path,visited}])=>`${name}: ${path.length?`${path.length-1} moves`:'no route'}, ${visited.length} cells explored`).join('. ')+'.';
  byId('compare').disabled=false;
});preset();
let queensRun=0;
function drawQueens(size,columns=[]){const board=byId('queens');board.style.gridTemplateColumns=`repeat(${size},1fr)`;board.setAttribute('aria-label',columns.length?columns.map((col,row)=>`Queen at row ${row+1}, column ${col+1}`).join('. '):`Empty ${size} by ${size} chessboard`);board.replaceChildren(...Array.from({length:size*size},(_,index)=>{const row=Math.floor(index/size),col=index%size;const square=document.createElement('span');square.className=`square${(row+col)%2?' alt':''}`;square.textContent=columns[row]===col?'♛':'';return square;}));}
function resetQueens(){queensRun++;byId('solve-queens').disabled=false;drawQueens(Number(byId('size').value));byId('queens-result').textContent='Choose a board size and start the solver.';}
byId('size').addEventListener('change',resetQueens);byId('reset-queens').addEventListener('click',resetQueens);
byId('solve-queens').addEventListener('click',async()=>{const run=++queensRun,size=Number(byId('size').value);byId('solve-queens').disabled=true;byId('queens-result').textContent='Solving…';let final=[],steps=0;for(const columns of queenSteps(size)){if(run!==queensRun)return;final=columns;steps++;if(!reduced.matches){drawQueens(size,columns);await delay(25);}}if(run!==queensRun)return;drawQueens(size,final);byId('queens-result').textContent=final.length===size?`Solution found after ${steps} placement and backtracking steps.`:'No solution found.';byId('solve-queens').disabled=false;});resetQueens();
let bookingRun=0;
function resetBooking(){bookingRun++;byId('booking-results').replaceChildren();byId('slot-state').textContent='Available';byId('race').disabled=false;}
byId('reset-race').addEventListener('click',resetBooking);
byId('booking-form').addEventListener('submit',async event=>{event.preventDefault();resetBooking();const run=bookingRun,claim=createSlot();byId('race').disabled=true;byId('slot-state').textContent='Waiting for requests…';await Promise.all(['a','b'].map(async key=>{await delay(byId(`delay-${key}`).valueAsNumber);if(run!==bookingRun)return;const customer=key.toUpperCase(),result=claim(customer),item=document.createElement('li');item.textContent=result.confirmed?`Customer ${customer}: confirmed for 10:00.`:`Customer ${customer}: conflict. Customer ${result.owner} already booked 10:00.`;byId('booking-results').append(item);byId('slot-state').textContent=`Booked by customer ${result.owner}`;}));if(run===bookingRun)byId('race').disabled=false;});
