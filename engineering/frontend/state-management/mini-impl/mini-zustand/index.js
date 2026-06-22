function create(createState) {
  let state;
  const listeners = new Set();

  const setState = (partial, replace) => {
    const nextState = typeof partial === "function" ? partial(state) : partial;

    if (!Object.is(nextState, state)) {
      const previoutState = state;
      state =
        (replace ?? typeof nextState !== "object")
          ? nextState
          : Object.assign({}, state, nextState);

      listeners.forEach((listener) => listener(state, previoutState));
    }
  };

  const getState = () => state;

  const subscribe = (listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const desctroy = () => listeners.clear();

  const api = {
    setState,
    getState,
    subscribe,
    desctroy,
  };

  state = createState(setState, getState, api);

  return (selector = getState, equalityFn = Object.is) => {
    const [, forceUpdate] = React.useReducer((c) => c + 1, 0);
    const stateRef = React.useRef();
    const selectorRef = React.useRef(selector);
    const equalityFnRef = React.useRef(equalityFn);

    const selectedState = selector(state);
    stateRef.current = selectedState;

    React.useEffect(() => {
      const listener = (newState) => {
        const newSelected = selectorRef.current(newState);
        if (!equalityFnRef.current(stateRef.current, newSelected)) {
          stateRef.current = newSelected;
          forceUpdate();
        }
      };

      const unsubscribe = subscribe(listener);
      return unsubscribe;
    }, []);
  };

  return selectedState;
}
