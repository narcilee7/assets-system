function createChild(obj) {
  const clone = Object.create(obj);
  clone.sayName = function () {
    console.log("Child Method");
  }
  return clone;
}


const parent = { name: "parent" };

const child = createChild(parent);