const {RandomPuzzle} = require('./puzzle');
const { getRandomBigInt } = require('./utils');


const n=63;



function round(t) {
  

console.log("t:", t);

const input = getRandomBigInt(n);


console.time('Puzzle initialization');
const puzzle = new RandomPuzzle(n, t);
console.timeEnd('Puzzle initialization');



console.time('LHTLPGen');




const {u, v, r} = puzzle.LHTLPGen(input);
console.timeEnd('LHTLPGen');



console.time('solvePuzzle');
const s = puzzle.solvePuzzle(u, v);
console.timeEnd('solvePuzzle');




console.log("");
}

for(let t=14; t<=29; t++) {
  console.error("t:", t);
  for(let i=0; i<4; i++) {
    round(t);
  }
}
