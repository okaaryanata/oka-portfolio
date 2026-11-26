import test from 'node:test';
import assert from 'node:assert/strict';
import {findPath,queenSteps,createSlot} from '../dist/algorithms.mjs';
test('BFS and A* find equal shortest paths through walls',()=>{
  const config={width:5,height:4,start:0,finish:19,walls:new Set([2,7,12])};
  const bfs=findPath(config),astar=findPath(config,true);
  assert.equal(bfs.path.length,astar.path.length);
  assert.equal(bfs.path.length,8);
  for(const {path} of [bfs,astar]) for(let i=1;i<path.length;i++) {
    assert.ok(!config.walls.has(path[i]));
    const a=path[i-1],b=path[i];
    assert.equal(Math.abs(a%5-b%5)+Math.abs(Math.floor(a/5)-Math.floor(b/5)),1);
  }
});
test('unreachable finish produces no route in both algorithms',()=>{
  for(const astar of [false,true]) assert.deepEqual(findPath({width:3,height:3,start:0,finish:8,walls:new Set([1,3])},astar).path,[]);
});
test('N-Queens solves all supported sizes without attacks',()=>{
  for(let size=4;size<=8;size++) {
    const boards=[...queenSteps(size)],solution=boards.at(-1);
    assert.equal(solution.length,size);
    for(let row=0;row<size;row++) for(let other=0;other<row;other++) {
      assert.notEqual(solution[row],solution[other]);
      assert.notEqual(Math.abs(solution[row]-solution[other]),row-other);
    }
  }
});
test('one slot confirms one claimant and rejects every later claim',()=>{
  const claim=createSlot();
  assert.deepEqual(claim('B'),{confirmed:true,owner:'B'});
  assert.deepEqual(claim('A'),{confirmed:false,owner:'B'});
  assert.deepEqual(claim('C'),{confirmed:false,owner:'B'});
  assert.deepEqual(createSlot()('A'),{confirmed:true,owner:'A'});
});
