/**
 * State Machine
 */
export interface QueryState<TData = any, TError = any> {
  data: TData | undefined;
  error: TError | null;
  status: "pending" | "success" | "error";
  isFetching: boolean;
  dataUpdatedAt: number;
}

export type QueryKey = string | unknown[];

function serializeKey(key: QueryKey): string {
  return JSON.stringify(key);
}

type QueryConfig = {
  queryKey: QueryKey;
  queryFn: (context: { queryKey: QueryKey }) => Promise<any>;
};

class Query {
  public state: QueryState;
  public queryKey: QueryKey;
  private queryFn: QueryConfig['queryFn'];
  private listeners: Set<() => void> = new Set();
  private promise: Promise<any> | null = null;

  constructor(config: QueryConfig) {
    this.queryKey = config.queryKey;
    this.queryFn = config.queryFn;

    // 初始状态为 pending
    this.state = {
      data: undefined,
      error: null,
      status: 'pending',
      isFetching: false,
      dataUpdatedAt: 0,
    };
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private dispatch(newState: Partial<QueryState>) {
    this.state = { ...this.state, ...newState };
    // 状态一旦发生任何变化，立即通知所有绑定了当前 Key 的 React 组件观察者
    this.listeners.forEach((listener) => listener());
  }

  // 核心 Fetch 方法（含去重机制）
  public async fetch(): Promise<any> {
    // 核心优化：并发去重。如果当前 Key 已经有一个请求在跑了，直接复用同一个 Promise
    if (this.promise) return this.promise;

    this.dispatch({ isFetching: true });

    this.promise = (async () => {
      try {
        const data = await this.queryFn({ queryKey: this.queryKey });
        this.dispatch({
          data,
          status: 'success',
          error: null,
          isFetching: false,
          dataUpdatedAt: Date.now(),
        });
        return data;
      } catch (error) {
        this.dispatch({
          status: 'error',
          error,
          isFetching: false,
        });
        throw error;
      } finally {
        this.promise = null; // 请求结束，清空 Promise 占用
      }
    })();

    return this.promise;
  }
}

export class QueryClient {
  private queries: Map<string, Query> = new Map();

  public buildQuery(cfg: QueryConfig): Query {
    const hash = serializeKey(cfg.queryKey);
    let query = this.queries.get(hash);

    if (!query) {
      query = new Query(cfg);
      this.queries.set(hash, query);
    }

    return query;
  }

  public invalidateQueries(queryKey: QueryKey) {
    const hash = serializeKey(queryKey);
    const query = this.queries.get(hash);
    if (query !== null && query !== undefined) {
      query.fetch();
    }
  }
}