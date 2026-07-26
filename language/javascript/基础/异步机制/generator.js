function* gen() {
  console.log("start");
  const a = yield 1;
  console.log("got: ", a);
  const b = yield 2;
  console.log("got: ", b);
  return "done";
}

const g = gen();

g.next();
g.next("A");
g.next("B");

function run(generator) {
  const g = generator();

  function next(value) {
    const result = g.next(value);

    if (result.done) {
      return Promise.resolve(result.value);
    }

    return Promise.resolve(result.value).then(
      (val) => next(val),
      (err) => g.throw(err),
    );
  }

  return next();
}

run(function* () {
  const a = yield fetch("/api/a");
  const b = yield fetch("/api/b");
  return [a, b];
});
