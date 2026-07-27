/**
 * Inputs
 * [2, 7, 11, 5]
 * target = 9
 * Output
 * [0, 1]
 */

const INPUTS = [2, 7, 11, 5];

const TARGET = 9;

const OUTPUT = [0, 1];

function solution(inputs, target) {
  // 需要一个map，存索引，key为值，value为索引，这样来实现for loop一次
  const helperMap = new Map();

  for (let i = 0; i < inputs.length; i++) {
    const diff = target - inputs[i];
    if (helperMap.has(diff)) {
      return [helperMap.get(diff), i];
    }
    helperMap.set(inputs[i], i);
  }
  return [];
}

console.log(solution(INPUTS, TARGET));
