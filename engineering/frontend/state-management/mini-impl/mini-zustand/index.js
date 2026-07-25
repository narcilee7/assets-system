const create = (createState) => {
  let state;
  const listeners = new Set();

  const setState = (partial, replace) => {
    const nextState = typeof partial === 'function' ? partial(state) : partial;

    if (!Object.is(nextState, state)) {
      const prevState = state;
      state = replace ?? typeof nextState !== 'object' ? nextState : Object.assign({}, state, nextState);
      listeners.forEach(l => l(state, prevState));
    }
  }

  const getState = () => state;

  const subscribe = (l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }

  const destroy = () => listeners.clear();

  const api = {
    setState,
    getState,
    subscribe,
    destroy,
  }

  state = createState(setState, getState, api);

  return (selector = getState, equalityFn = Object.is) => {
    const [, forceUpdate] = React.useReducer(c => c + 1, 0);
    const stateRef = React.useRef();
    const selectorRef = React.useRef(selector);
    const equalityFnRef = React.useRef(equalityFn);

    const selectedState = selector(state);
    stateRef.current = selectedState;

    React.useEffect(() => {
      const listenr = (newState) => {
        const newSelected = selectorRef.current(newState);
        if (!equalityFnRef.current(stateRef.current, newSelected)) {
          stateRef.current = newSelected;
          forceUpdate();
        }
      };

      return subscribe(listenr);
    }, [])
  }
}