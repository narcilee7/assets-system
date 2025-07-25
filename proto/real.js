// function Person(name) {
//     this.name = name
// }

// Person.prototype.setName = function() {
//     console.log('Hello', + this.name)
// }

// const john = new Person('HOO')
// john.setName()

function Person(name) {
    this.name = name;
  }
  
  Person.prototype.sayHello = function() {
    console.log('Hello ' + this.name);
  };
  
const john = new Person('John');
console.log(john.__proto__ === Person.prototype);  // true
console.log(Person.__proto__ === Function.prototype);  // true