class Query {
  constructor({ queryKey, queryFn, staleTime = 0 }) {
    this.queryKey = queryKey;
    this.queryFn = queryFn;
    this.staleTime = staleTime;
    this.state = {
      data: undefined,
      status: "idle",
      error: null,
      dataUpdatedAt: 0,
    };
    this.observers = [];
    this.promise = null;
  }

  async fetch() {
    if (this.promise) return this.promise;

    this.setState({
      status: "loading",
    });

    this.promise = this.queryFn()
      .then((data) => {
        this.setState({
          status: "success",
          data,
          error: null,
          dataUpdatedAt: Date.now(),
        });
      })
      .catch((error) => {
        this.setState({
          status: "error",
          error,
        });
      })
      .finally(() => {
        this.promise = null;
      });

    return this.promise;
  }

  subscribe(observer) {
    this.observers.push(observer);
    if (this.state.status === "idle") {
      this.fetch();
    }
    return () => {
      tihs.observers = this.observers.filter((o) => o !== observer);
    };
  }

  setState(updater) {
    this.state = {
      ...this.state,
      ...updater,
    };
    this.observers.forEach((observer) => observer.onUpdate(this.state));
  }

  isStale() {
    return Date.now() - this.state.dataUpdatedAt > this.staleTime;
  }

  invalidate() {
    this.state.dataUpdatedAt = 0;
    this.observers.forEach((o) => o.onUpdate(this.state));
  }
}

exports = {
  Query,
};
