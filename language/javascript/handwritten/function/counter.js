function createCounter() {
    let count = 0

    return {
        increment: function() {
            count++
            return count
        },
        decrement: function() {
            count--
            return count
        },
        getCount: function() {
            return count
        }
    }
}

const counter = createCounter()

console.log(counter.increment())
console.log(counter.increment())