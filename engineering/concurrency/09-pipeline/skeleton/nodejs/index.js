// 并发模型：async/await + async generators
async function* generate(n) {
    // TODO: yield 1..n
}

async function* square(source) {
    // TODO: for await (const x of source) yield x * x
}

async function sum(source) {
    // TODO: for await (const x of source) 累加，返回总和
    return 0;
}

async function main() {
    const n = 100;
    const expected = (n * (n + 1) * (2 * n + 1)) / 6;

    const gen = generate(n);
    const sq = square(gen);
    const actual = await sum(sq);

    if (actual === expected) {
        console.log(`PASS: sum = ${actual} (expected ${expected})`);
    } else {
        console.log(`FAIL: sum = ${actual} (expected ${expected})`);
    }
}

main().catch(console.error);
