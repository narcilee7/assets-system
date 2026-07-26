function Foo() {
    Foo.a = function () {
        console.log(1)
    }
    this.a = function () {
        console.log(2)
    }
}

Foo.prototype.a = function () {
    console.log(3)
}

Foo.a = function () {
    console.log(4)
}

Foo.a() // 4
const obj = new Foo()
obj.a() // -> obj.prototype.a -> Foo.a // 2
Foo.a() // 1
