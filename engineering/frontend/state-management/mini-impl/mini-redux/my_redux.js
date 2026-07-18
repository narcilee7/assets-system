const createStore = (reducer, preloadState, enhancer) => {
  if (typeof enhancer === 'function') {
    return enhancer(createStore(reducer, preloadState, enhancer))
  }

  let curState = preloadState;
  let curReducer = reduer;
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
    } catch {
      console.loe('dispatch error')
    } finally {
      isDispaching = false;
    }

    listeners.slice().forEach(l => l());

    return action;
  }

  const subscribe = (l) => {
    listeners.push(l)

    return function unsubscribe() {
      const idx = listeners.indexOf(l);
      if (idx === -1) {
        listeners.splice(idx, 1);
      }
    }
  }

  dispatch({ type: "@@redux/INIT" });

  return {
    getState,
    dispatch,
    subscribe,
  };
}