function PromiseAny(promises) {
  return new Promise((resolve, reject) => {
    const errors = []
    let rejectCount = 0

    if (promises.length === 0) {
        reject(new AggregateError('All promises were rejected'))
        return 
    }

    promises.forEach((p, i) => {
        Promise.resolve(p)
            .then(
                v => resolve(v),
                err => {
                    errors[i] = err
                    if (++rejectCount === promises.length) {
                        reject(new AggregateError(errors))
                    }
                }
            )
            .finally(() => {
                if (++completed === promises.length) {
                    resolve(results)
                }
            })
    })
  })
}