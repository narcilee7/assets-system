function Parent() {
    this.colors = ['red', 'blue'];
}

function Child() {

}

Child.prototype = new Parent()

const c1 = new Child()
c1.colors.push('green')

const c2 = new Child()
console.log(c2.colors)

function Parent2(name) {
    this.name = name
}

function Child2(name, age) {
    Parent2.call(this, name)
    this.age = age
}

const c21 = new Child2('Tom', 29)
