function PromiseRace(promises) {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(promises)) {
      reject(new TypeError("Argument must be an array"));
      return;
    }
    if (promises.length === 0) {
      resolve([]);
      return;
    }
    let settled = false;
      promises.forEach((promise) => {
        Promise.resolve(promise)
          .then((value) => {
            if (!settled) {
              settled = true;
              resolve(value);
            }
          })
          .catch((reason) => {
            if (!settled) {
              settled = true;
              reject(reason);
            }
          });
      });
  });
}

async function main() {
  const promises = [
    new Promise((resolve) => setTimeout(() => resolve(1), 100)),
    // new Promise((_, reject) => setTimeout(() => reject(new Error("Error")), 200)),
    new Promise((resolve) => setTimeout(() => resolve(3), 50))
  ]

  try {
    console.log('123123')
    const result = await PromiseRace(promises);
    const realResult = await Promise.race(promises);
    console.log(result === realResult); // true
    console.log(realResult); // 1
    console.log(result);
  } catch (error) {
    console.error(error);
  }
}

main()