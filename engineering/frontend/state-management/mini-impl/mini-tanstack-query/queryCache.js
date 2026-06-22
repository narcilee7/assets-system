import Query from "./query";

class QueryCache {
  constructor() {
    this.queries = new Map();
  }

  build(queryKey, queryFn, options) {
    const key = JSON.stringify(queryKey);
    let query = this.queries.get(key);

    if (!query) {
      query = new Query({
        queryKey,
        queryFn,
        ...options,
      });
      this.queries.set(key, query);
    }

    return query;
  }

  invalidateQuries(queryKey) {
    const key = JSON.stringify(queryKey);
    for (const [k, query] of this.queries) {
      if (k.startsWith(key)) {
        query.invalidate();
      }
    }
  }
}
