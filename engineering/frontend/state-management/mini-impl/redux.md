# 手写 Redux

## 1. 核心 API

Redux 核心就三个东西：
- `createStore(reducer)` — 创建 store
- `store.dispatch(action)` — 发送 action
- `store.subscribe(listener)` — 订阅变化

## 2. 实现

```javascript
// mini-redux.js

function createStore(reducer, preloadedState, enhancer) {
  // 支持 middleware 增强
  if (typeof enhancer === 'function') {
    return enhancer(createStore)(reducer, preloadedState);
  }

  let currentState = preloadedState;
  let currentReducer = reducer;
  let listeners = [];
  let isDispatching = false;

  function getState() {
    return currentState;
  }

  function dispatch(action) {
    if (isDispatching) {
      throw new Error('Reducers may not dispatch actions.');
    }

    try {
      isDispatching = true;
      currentState = currentReducer(currentState, action);
    } finally {
      isDispatching = false;
    }

    // 通知所有订阅者
    listeners.slice().forEach((listener) => listener());

    return action;
  }

  function subscribe(listener) {
    listeners.push(listener);

    return function unsubscribe() {
      const index = listeners.indexOf(listener);
      if (index !== -1) listeners.splice(index, 1);
    };
  }

  // 初始化 state（dispatch 一个特殊的 action）
  dispatch({ type: '@@redux/INIT' });

  return { getState, dispatch, subscribe };
}

// ============ 使用 ============

function counterReducer(state = { count: 0 }, action) {
  switch (action.type) {
    case 'INCREMENT':
      return { count: state.count + 1 };
    case 'DECREMENT':
      return { count: state.count - 1 };
    default:
      return state;
  }
}

const store = createStore(counterReducer);

store.subscribe(() => {
  console.log('State:', store.getState());
});

store.dispatch({ type: 'INCREMENT' });  // State: { count: 1 }
store.dispatch({ type: 'INCREMENT' });  // State: { count: 2 }
store.dispatch({ type: 'DECREMENT' });  // State: { count: 1 }
```

## 3. Middleware 系统

```javascript
// applyMiddleware 实现
function applyMiddleware(...middlewares) {
  return (createStore) => (reducer, preloadedState) => {
    const store = createStore(reducer, preloadedState);
    let dispatch = () => {
      throw new Error('Dispatching while constructing middleware is not allowed.');
    };

    const middlewareAPI = {
      getState: store.getState,
      dispatch: (action) => dispatch(action),
    };

    const chain = middlewares.map((middleware) => middleware(middlewareAPI));
    dispatch = compose(...chain)(store.dispatch);

    return { ...store, dispatch };
  };
}

// compose 实现
function compose(...fns) {
  return fns.reduce(
    (a, b) => (...args) => a(b(...args)),
    (arg) => arg
  );
}

// logger middleware
const logger = (store) => (next) => (action) => {
  console.log('dispatching', action);
  const result = next(action);
  console.log('next state', store.getState());
  return result;
};

// thunk middleware
const thunk = (store) => (next) => (action) => {
  if (typeof action === 'function') {
    return action(store.dispatch, store.getState);
  }
  return next(action);
};

// 使用
const store = createStore(
  counterReducer,
  applyMiddleware(thunk, logger)
);

// 异步 action
function fetchUser() {
  return async (dispatch) => {
    dispatch({ type: 'FETCH_USER_START' });
    const user = await api.fetchUser();
    dispatch({ type: 'FETCH_USER_SUCCESS', payload: user });
  };
}

store.dispatch(fetchUser());
```

## 4. combineReducers

```javascript
function combineReducers(reducers) {
  return (state = {}, action) => {
    const nextState = {};
    let hasChanged = false;

    for (const key of Object.keys(reducers)) {
      const previousStateForKey = state[key];
      const nextStateForKey = reducers[key](previousStateForKey, action);
      nextState[key] = nextStateForKey;
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
    }

    return hasChanged ? nextState : state;
  };
}

// 使用
const rootReducer = combineReducers({
  counter: counterReducer,
  user: userReducer,
});

// State: { counter: { count: 0 }, user: { name: null } }
```
