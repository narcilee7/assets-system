/**
 * 手写 Trie
 *
 * 考点：
 * - 前缀树节点结构。
 * - 插入、查找、前缀匹配、自动补全。
 */

export class Trie {
  private root = new TrieNode();

  insert(word: string): void {
    let node = this.root;
    for (const char of word) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }
      node = node.children.get(char)!;
    }
    node.isEnd = true;
  }

  search(word: string): boolean {
    const node = this.find(word);
    return node !== null && node.isEnd;
  }

  startsWith(prefix: string): boolean {
    return this.find(prefix) !== null;
  }

  autocomplete(prefix: string): string[] {
    const node = this.find(prefix);
    if (node === null) return [];
    const results: string[] = [];
    this.collect(node, prefix, results);
    return results;
  }

  private find(word: string): TrieNode | null {
    let node = this.root;
    for (const char of word) {
      if (!node.children.has(char)) return null;
      node = node.children.get(char)!;
    }
    return node;
  }

  private collect(node: TrieNode, prefix: string, results: string[]): void {
    if (node.isEnd) results.push(prefix);
    for (const [char, child] of node.children) {
      this.collect(child, prefix + char, results);
    }
  }
}

class TrieNode {
  children = new Map<string, TrieNode>();
  isEnd = false;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const trie = new Trie();
  trie.insert("apple");
  trie.insert("app");
  console.log(trie.search("app"));       // true
  console.log(trie.autocomplete("app")); // ['app', 'apple']
}
