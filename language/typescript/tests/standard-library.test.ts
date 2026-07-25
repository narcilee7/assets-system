import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  binarySearch,
  dfs,
  LRUCache,
  MinStack,
  topK,
  topologicalSort,
  Trie,
} from "../standard-library/index.js";

describe("standard-library", () => {
  describe("data-structures", () => {
    it("LRUCache evicts least recently used", () => {
      const cache = new LRUCache<number, string>(2);
      cache.put(1, "a");
      cache.put(2, "b");
      cache.get(1);
      cache.put(3, "c");
      assert.equal(cache.has(2), false);
      assert.equal(cache.has(1), true);
    });

    it("MinStack tracks minimum", () => {
      const s = new MinStack<number>();
      s.push(3);
      s.push(1);
      s.push(2);
      assert.equal(s.getMin(), 1);
      s.pop();
      assert.equal(s.getMin(), 1);
    });

    it("topK", () => {
      assert.deepEqual(topK([3, 1, 5, 2], 2), [3, 5]);
    });

    it("Trie", () => {
      const trie = new Trie();
      trie.insert("apple");
      trie.insert("app");
      assert.equal(trie.search("app"), true);
      assert.equal(trie.search("appl"), false);
      assert.deepEqual(trie.autocomplete("app").sort(), ["app", "apple"]);
    });

    it("binarySearch", () => {
      assert.equal(binarySearch([1, 3, 5, 7, 9], 5), 2);
      assert.equal(binarySearch([1, 3, 5], 4), -1);
    });

    it("dfs", () => {
      const graph = new Map<string, string[]>([
        ["A", ["B", "C"]],
        ["B", ["D"]],
        ["C", ["D"]],
        ["D", []],
      ]);
      assert.deepEqual([...dfs(graph, "A")], ["A", "B", "D", "C"]);
    });

    it("topologicalSort detects cycle", () => {
      assert.deepEqual(topologicalSort(new Map([["A", ["B"]], ["B", ["C"]], ["C", []]])), [
        "A",
        "B",
        "C",
      ]);
      assert.throws(() => topologicalSort(new Map([["A", ["B"]], ["B", ["A"]]])));
    });
  });
});
