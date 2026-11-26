import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBoard,solveBoard,sample} from '../dist/sudoku.mjs';
const sampleBoard=()=>Array.from({length:9},(_,row)=>[...sample.slice(row*9,row*9+9)].map(Number));
test('editable Sudoku validates shape, range, row, column and box clues',()=>{assert.equal(validateBoard(sampleBoard()),'');for(const [row,col,value] of [[0,2,5],[1,2,5],[1,1,5],[0,2,10]]){const board=sampleBoard();board[row][col]=value;assert.ok(validateBoard(board));}assert.ok(validateBoard([[0]]));});
test('Sudoku uses the Go API and reports error responses',async()=>{const original=globalThis.fetch;try{globalThis.fetch=async(url,options)=>{assert.equal(url,'/api/v1/sudoku/solve');assert.deepEqual(JSON.parse(options.body).board,sampleBoard());return {ok:false,status:422,json:async()=>({error:{message:'board has no solution'}})};};await assert.rejects(solveBoard(sampleBoard()),/no solution/);}finally{globalThis.fetch=original;}});
