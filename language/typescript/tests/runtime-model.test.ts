import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chunk } from "../runtime-model/chunk.js";
import { dedup } from "../runtime-model/dedup.js";
import { deepClone } from "../runtime-model/deepClone.js";
import { flatten } from "../runtime-model/flatten.js";
import { groupBy } from "../runtime-model/groupBy.js";
import { createCounter, makeMultiplier } from "../runtime-model/scopeAndClosure.js";

describe("runtime-model", () => {
  describe("deepClone", () => {
    it("clones nested objects", () => {
      const src = { a: 1, b: { c: 2 } };
      const copy = deepClone(src);
      assert.notEqual(copy, src);
      assert.equal(copy.a, 1);
      assert.notEqual(copy.b, src.b);
    });

    it("handles circular references", () => {
      const src: { self?: unknown } = {};
      src.self = src;
      const copy = deepClone(src);
      assert.equal(copy.self, copy);
    });

    it("clones Map and Set", () => {
      const map = new Map([["a", 1]]);
      const set = new Set([1, 2]);
      assert.deepEqual([...deepClone(map).entries()], [["a", 1]]);
      assert.deepEqual([...deepClone(set).values()], [1, 2]);
    });
  });

  describe("flatten", () => {
    it("flattens nested arrays", () => {
      assert.deepEqual(flatten([1, [2, [3, 4]], 5]), [1, 2, 3, 4, 5]);
    });

    it("respects depth", () => {
      assert.deepEqual(flatten([1, [2, [3]]], 1), [1, 2, [3]]);
    });
  });

  describe("dedup", () => {
    it("removes duplicates", () => {
      assert.deepEqual(dedup([1, 2, 2, 3, 1]), [1, 2, 3]);
    });

    it("supports key function", () => {
      assert.deepEqual(
        dedup(["Apple", "banana", "apricot"], (w) => w.toLowerCase()),
        ["Apple", "banana", "apricot"]
      );
    });
  });

  describe("groupBy", () => {
    it("groups by key", () => {
      const result = groupBy(["apple", "banana", "avocado"], (w) => w[0]);
      assert.deepEqual(result, { a: ["apple", "avocado"], b: ["banana"] });
    });
  });

  describe("chunk", () => {
    it("chunks evenly", () => {
      assert.deepEqual([...chunk([1, 2, 3, 4, 5, 6], 3)], [[1, 2, 3], [4, 5, 6]]);
    });

    it("fills last chunk", () => {
      assert.deepEqual([...chunk([1, 2, 3], 2, 0)], [[1, 2], [3, 0]]);
    });
  });

  describe("scopeAndClosure", () => {
    it("counts with closure", () => {
      const c = createCounter();
      assert.equal(c.increment(), 1);
      assert.equal(c.increment(), 2);
    });

    it("multiplies with closure", () => {
      assert.equal(makeMultiplier(3)(5), 15);
    });
  });
});
