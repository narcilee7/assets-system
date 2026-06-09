# Redux 体系

## 1. Redux Core：三原则

```
1. Single Source of Truth    单一状态树
2. State is Read-Only        只通过 action 修改
3. Changes via Pure Reducers 纯函数 reducer
```

```
View ──dispatch──> Action ──> Reducer ──> Store ──> View
                  { type, payload }    (state, action) => newState
```

## 2. 经典 Redux（现在不推荐直接使用）

```js
// store.js
import { createStore } from 'redux';

const initialState = { count: 0, user: null };

function reducer(state = initialState, action) {
  switch (action.type) {
    case 'INCREMENT':
      return { ...state, count: state.count + 1 };
    case 'SET_USER':
      return { ...state, user: action.payload };
    default:
      return state;
  }
}

const store = createStore(reducer);

// 使用
store.dispatch({ type: 'INCREMENT' });
store.dispatch({ type: 'SET_USER', payload: { name: 'John' } });
store.getState();  // { count: 1, user: { name: 'John' } }
store.subscribe(() => console.log(store.getState()));
```

**经典 Redux 的问题**：
- 样板代码多（action types、action creators、switch case）
- 不可变性手动维护（容易出错）
- 异步逻辑复杂（需要 redux-thunk / redux-saga）

## 3. Redux Toolkit（推荐）

```ts
// store.ts
import { configureStore } from '@reduxjs/toolkit';
import counterSlice from './counterSlice';
import userSlice from './userSlice';

export const store = configureStore({
  reducer: {
    counter: counterSlice,
    user: userSlice,
  },
  middleware: (getDefault) => getDefault().concat(loggerMiddleware),
  devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

```ts
// counterSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface CounterState {
  value: number;
  loading: boolean;
}

const initialState: CounterState = { value: 0, loading: false };

const counterSlice = createSlice({
  name: 'counter',
  initialState,
  reducers: {
    increment: (state) => { state.value += 1; },  // Immer 自动处理不可变性
    decrement: (state) => { state.value -= 1; },
    incrementByAmount: (state, action: PayloadAction<number>) => {
      state.value += action.payload;
    },
  },
  extraReducers: (builder) => {
    // 处理其他 slice 的 action 或 async thunk
    builder
      .addCase(fetchUser.fulfilled, (state) => { state.loading = false; })
      .addCase(fetchUser.pending, (state) => { state.loading = true; });
  },
});

export const { increment, decrement, incrementByAmount } = counterSlice.actions;
export default counterSlice.reducer;
```

```ts
// 组件中使用
import { useSelector, useDispatch } from 'react-redux';
import { increment, incrementByAmount } from './counterSlice';
import type { RootState } from './store';

function Counter() {
  const count = useSelector((state: RootState) => state.counter.value);
  const dispatch = useDispatch();

  return (
    <div>
      <span>{count}</span>
      <button onClick={() => dispatch(increment())}>+1</button>
      <button onClick={() => dispatch(incrementByAmount(5))}>+5</button>
    </div>
  );
}
```

## 4. Async Thunk

```ts
import { createAsyncThunk } from '@reduxjs/toolkit';

// 创建 async thunk
const fetchUser = createAsyncThunk(
  'user/fetchUser',
  async (userId: string, { rejectWithValue }) => {
    try {
      const response = await api.getUser(userId);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

// slice 中处理三种状态
const userSlice = createSlice({
  name: 'user',
  initialState: { data: null, loading: false, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

// 使用
dispatch(fetchUser('123'));
```

## 5. RTK Query

```ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Post', 'User'],
  endpoints: (builder) => ({
    getPosts: builder.query<Post[], void>({
      query: () => '/posts',
      providesTags: ['Post'],
    }),
    getPost: builder.query<Post, string>({
      query: (id) => `/posts/${id}`,
      providesTags: (result, error, id) => [{ type: 'Post', id }],
    }),
    addPost: builder.mutation<Post, Partial<Post>>({
      query: (body) => ({ url: '/posts', method: 'POST', body }),
      invalidatesTags: ['Post'],
    }),
  }),
});

export const { useGetPostsQuery, useGetPostQuery, useAddPostMutation } = api;
```

## 6. Middleware

```ts
// 自定义 middleware
const loggerMiddleware = (store) => (next) => (action) => {
  console.log('dispatching', action);
  const result = next(action);
  console.log('next state', store.getState());
  return result;
};

// Redux Toolkit 默认包含的 middleware：
// - redux-thunk（异步 action）
// - immutable-state-invariant（开发环境检测不可变性）
// - serializable-state-invariant（开发环境检测序列化）
