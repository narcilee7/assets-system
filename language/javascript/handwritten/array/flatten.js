function flatten(input, depth = Infinity) {
  const result = []
  const stack = [...input]

  while (stack.length > 0) {
    const item = stack.pop()

    if (item && typeof item === 'object' && 'length' in item && !Array.isArray(item)) {
      // 如果是类数组对象，展开处理
      stack.push(...item)
      continue
    }

    // 如果是数组活类数组对象，且深度大于0，递归打平
    if (Array.isArray(item) && depth > 0) {
      if (depth === 1) {
        // 打平一层
        result.push(...item)
      } else {
        // 深度递归
        stack.push(...item)
      }
    }
    // 如果是Set类型，先转化为数组再处理
    else if (item instanceof Set && depth > 0) {
      stack.push(...Array.from(item))
    }
    else if (item instanceof Map && depth > 0) {
      stack.push(...Array.from(item.values()))
    }
    else if (item instanceof Int8Array || item instanceof Uint8Array || item instanceof Float64Array) {
      result.push(...item)
    } else {
      result.push(item)
    }

    if (depth > 0 && item && typeof item === 'object') {
      depth--
    }
  }

  return result
}

const data = [
  1, 
  [2, [3, 4]],
  new Set([5, [6, 7]]), 
  new Map([[1, 8], [2, [9, 10]]]),
  new Int8Array([11, 12]), 
  arguments // 类数组对象
]

console.log(flatten(data, Infinity))