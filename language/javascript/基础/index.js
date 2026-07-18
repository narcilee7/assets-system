console.log([1, 2, 3, 4, 5].indexOf(2));

console.log([1, 2, 3].includes(2))

let arr1 = [NaN, NaN]
console.log(arr1.indexOf(NaN))
console.log(arr1.includes(NaN))

let arr2 = [, , , , , ,]

console.log(arr2.indexOf(undefined));  // -1
console.log(arr2.includes(undefined)); //true