async function foo() {
  const a = await 1;
  const b = await Promise.resolve(2);
  return a + b;
}

function foo() {
  return new Promise((resolve, reject) => {
    const a = 1;
    Promise.resolve(a)
      .then((val1) => {
        const b = Promise.resolve(2);
        Promise.resolve(b)
          .then((val2) => {
            resolve(val1 + val2);
          })
          .catch(reject);
      })
      .catch(reject);
  });
}

async function myFail() {
  throw new Error("fail");
}

myFail().catch((err) => console.log(err.message));

async function handle() {
  try {
    await myFail();
  } catch (err) {
    console.log(err.message);
  }
}

handle();
