function foo() {
  console.log(this)
}

foo()

foo.call({ a: 1 })
foo.apply({ a: 2 })

const bound = foo.bind({ a: 3 })
bound()

new foo()
