import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { memoize, once, retry, timer } from "../core-abstractions/index.js";
import { chain, enumerate, range, zip } from "../core-abstractions/iterators/index.js";
import { curry, pipe } from "../core-abstractions/functions/index.js";
import { promiseAll, promiseAllSettled, promiseAny, promiseRace } from "../core-abstractions/promises/index.js";

describe("core-abstractions", () => {
  describe("iterators", () => {
    it("range", () => {
      assert.deepEqual([...range(5)], [0, 1, 2, 3, 4]);
      assert.deepEqual([...range(1, 5)], [1, 2, 3, 4]);
    });

    it("enumerate", () => {
      assert.deepEqual([...enumerate(["a", "b"])], [[0, "a"], [1, "b"]]);
    });

    it("zip", () => {
      assert.deepEqual([...zip([1, 2], ["a", "b"])], [[1, "a"], [2, "b"]]);
    });

    it("chain", () => {
      assert.deepEqual([...chain([1, 2], [3, 4])], [1, 2, 3, 4]);
    });
  });

  describe("decorators", () => {
    it("once", () => {
      let calls = 0;
      const fn = once(() => ++calls);
      fn();
      fn();
      assert.equal(calls, 1);
    });

    it("memoize", () => {
      let calls = 0;
      const fn = memoize((n: number) => {
        calls++;
        return n * 2;
      });
      fn(5);
      fn(5);
      assert.equal(calls, 1);
    });

    it("retry succeeds", async () => {
      let attempts = 0;
      const result = await retry(() => {
        attempts++;
        if (attempts < 3) throw new Error("fail");
        return "ok";
      }, { maxAttempts: 3, delay: 0 });
      assert.equal(result, "ok");
    });
  });

  describe("promises", () => {
    it("promiseAll", async () => {
      assert.deepEqual(await promiseAll([Promise.resolve(1), 2, Promise.resolve(3)]), [1, 2, 3]);
    });

    it("promiseRace", async () => {
      assert.equal(await promiseRace([Promise.resolve("ok"), new Promise(() => {})]), "ok");
    });

    it("promiseAllSettled", async () => {
      const result = await promiseAllSettled([Promise.resolve(1), Promise.reject("err"), 3]);
      assert.equal(result[0].status, "fulfilled");
      assert.equal(result[1].status, "rejected");
    });

    it("promiseAny", async () => {
      assert.equal(await promiseAny([Promise.reject("err"), Promise.resolve("ok")]), "ok");
    });
  });

  describe("functions", () => {
    it("curry", () => {
      const add = (a: number, b: number, c: number) => a + b + c;
      assert.equal(curry(add)(1)(2)(3), 6);
    });

    it("pipe", () => {
      const result = pipe<number>(
        (x) => x + 1,
        (x) => x * 2
      )(5);
      assert.equal(result, 12);
    });
  });
});
