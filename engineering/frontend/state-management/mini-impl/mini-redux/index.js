function createStore(reducer, preloadedState, enhancer) {
  if (typeof enhancer === "function") {
    // return enhancer(createStore(reducer, preloadedState, enhancer));
    return enhancer(createStore(reducer, preloadedState, enhancer));
  }

  let curState = preloadedState;
  let curReducer = reducer;
  let listeners = [];
  let isDispaching = false;

  const getState = () => curState;

  const dispatch = (action) => {
    if (isDispaching) {
      throw new Error("reducers may not dispatch actions.");
    }

    try {
      isDispaching = true;
      curState = curReducer(curState, action);
    } finally {
      isDispaching = false;
    }

    listeners.slice().forEach((listener) => listener());

    return action;
  };

  const subscribe = (listener) => {
    listeners.push(listener);

    return function unsubscribe() {
      const idx = listeners.indexOf(listener);
      if (idx !== -1) {
        listeners.splice(idx, 1);
      }
    };
  };

  dispatch({ type: "@@redux/INIT" });

  return {
    getState,
    dispatch,
    subscribe,
  };
}
