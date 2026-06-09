# 手写 TanStack Query

## 1. 核心概念

```
QueryClient
    ├── QueryCache
    │     ├── Query (key: ['posts'])
    │     │     ├── state: { data, status, error }
    │     │     ├── observers: [Observer, Observer]
    │     │     ├── staleTime
    │     │     └── gcTime
    │     └── Query (key: ['post', 1])
    └── MutationCache
```

## 2. 简化实现

```javascript
// mini-query.js

class Query {
  constructor({ queryKey, queryFn, staleTime = 0 }) {
    this.queryKey = queryKey;
    this.queryFn = queryFn;
    this.staleTime = staleTime;
    this.state = {
      data: undefined,
      status: 'idle',  // idle | loading | success | error
      error: null,
      dataUpdatedAt: 0,
    };
    this.observers = [];
    this.promise = null;
  }

  subscribe(observer) {
    this.observers.push(observer);
    // 如果没有数据且不在加载中，自动获取
    if (this.state.status === 'idle') {
      this.fetch();
    }
    return () => {
      this.observers = this.observers.filter((o) => o !== observer);
    };
  }

  async fetch() {
    // 如果已经在请求中，返回同一个 promise（去重）
    if (this.promise) return this.promise;

    this.setState({ status: 'loading' });

    this.promise = this.queryFn()
      .then((data) => {
        this.setState({
          status: 'success',
          data,
          error: null,
          dataUpdatedAt: Date.now(),
        });
        return data;
      })
      .catch((error) => {
        this.setState({ status: 'error', error });
        throw error;
      })
      .finally(() => {
        this.promise = null;
      });

    return this.promise;
  }

  setState(updater) {
    this.state = { ...this.state, ...updater };
    this.observers.forEach((observer) => observer.onUpdate(this.state));
  }

  isStale() {
    return Date.now() - this.state.dataUpdatedAt > this.staleTime;
  }

  invalidate() {
    this.state.dataUpdatedAt = 0;  // 标记为 stale
    this.observers.forEach((observer) => observer.onUpdate(this.state));
  }
}

class QueryCache {
  constructor() {
    this.queries = new Map();  // key string -> Query
  }

  build(queryKey, queryFn, options) {
    const key = JSON.stringify(queryKey);
    let query = this.queries.get(key);

    if (!query) {
      query = new Query({ queryKey, queryFn, ...options });
      this.queries.set(key, query);
    }

    return query;
  }

  invalidateQueries(queryKey) {
    const key = JSON.stringify(queryKey);
    for (const [k, query] of this.queries) {
      if (k.startsWith(key)) {
        query.invalidate();
      }
    }
  }
}

class QueryClient {
  constructor(options = {}) {
    this.cache = new QueryCache();
    this.defaultOptions = options.defaultOptions || {};
  }

  useQuery(queryKey, queryFn, options = {}) {
    const mergedOptions = {
      ...this.defaultOptions.queries,
      ...options,
    };

    const query = this.cache.build(queryKey, queryFn, mergedOptions);
    const [state, setState] = React.useState(query.state);

    React.useEffect(() => {
      const observer = {
        onUpdate: (newState) => setState({ ...newState }),
      };
      return query.subscribe(observer);
    }, [query]);

    const refetch = React.useCallback(() => query.fetch(), [query]);

    return { ...state, refetch };
  }

  invalidateQueries(queryKey) {
    this.cache.invalidateQueries(queryKey);
  }
}

// ============ 使用 ============

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5000 },
  },
});

function Posts() {
  const { data, status, error, refetch } = queryClient.useQuery(
    ['posts'],
    async () => {
      const res = await fetch('/api/posts');
      return res.json();
    },
    { staleTime: 10000 }
  );

  if (status === 'loading') return <div>Loading...</div>;
  if (status === 'error') return <div>Error: {error.message}</div>;

  return (
    <div>
      {data.map((post) => <p key={post.id}>{post.title}</p>)}
      <button onClick={refetch}>Refresh</button>
    </div>
  );
}

// Mutation 简化版
class Mutation {
  constructor({ mutationFn }) {
    this.mutationFn = mutationFn;
    this.state = { status: 'idle', error: null };
    this.observers = [];
  }

  async mutate(variables) {
    this.setState({ status: 'loading', error: null });
    try {
      const data = await this.mutationFn(variables);
      this.setState({ status: 'success' });
      return data;
    } catch (error) {
      this.setState({ status: 'error', error });
      throw error;
    }
  }

  setState(updater) {
    this.state = { ...this.state, ...updater };
    this.observers.forEach((o) => o.onUpdate(this.state));
  }
}

function useMutation(mutationFn) {
  const mutationRef = React.useRef(new Mutation({ mutationFn }));
  const [state, setState] = React.useState(mutationRef.current.state);

  React.useEffect(() => {
    const observer = { onUpdate: setState };
    mutationRef.current.observers.push(observer);
  }, []);

  const mutate = React.useCallback(
    (variables) => mutationRef.current.mutate(variables),
    []
  );

  return { ...state, mutate };
}
```
