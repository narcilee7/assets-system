# SWR & Apollo Client

## 1. SWR（Vercel 出品）

SWR = Stale-While-Revalidate：先返回缓存（stale），同时发起请求重新验证（revalidate）。

```tsx
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function Profile() {
  const { data, error, isLoading, mutate } = useSWR('/api/user', fetcher, {
    revalidateOnFocus: true,      // 窗口聚焦时重新验证
    revalidateOnReconnect: true,  // 网络恢复时重新验证
    refreshInterval: 5000,        // 每 5 秒轮询
    dedupingInterval: 2000,       // 2 秒内相同 key 的请求去重
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error</div>;

  return (
    <div>
      <h1>{data.name}</h1>
      <button onClick={() => mutate()}>Refresh</button>
    </div>
  );
}

// 全局配置
import { SWRConfig } from 'swr';

function App() {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,
      }}
    >
      <MyApp />
    </SWRConfig>
  );
}

// Mutation
import useSWRMutation from 'swr/mutation';

function CreatePost() {
  const { trigger, isMutating } = useSWRMutation(
    '/api/posts',
    (url, { arg }) => fetch(url, { method: 'POST', body: JSON.stringify(arg) })
  );

  return <button onClick={() => trigger({ title: 'New Post' })}>Create</button>;
}
```

**SWR vs TanStack Query**：
- SWR 更轻量（~4KB vs ~12KB）
- TanStack Query 功能更全（dev tools、mutation helpers、infinite query）
- SWR 的 API 更简洁

## 2. Apollo Client（GraphQL）

```tsx
import { ApolloClient, InMemoryCache, gql, useQuery, useMutation } from '@apollo/client';

// 创建客户端
const client = new ApolloClient({
  uri: '/graphql',
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          posts: {
            // 自定义合并策略
            merge(existing = [], incoming) {
              return [...existing, ...incoming];
            },
          },
        },
      },
    },
  }),
});

// 查询
const GET_POSTS = gql`
  query GetPosts($limit: Int!) {
    posts(limit: $limit) {
      id
      title
      author {
        name
      }
    }
  }
`;

function Posts() {
  const { data, loading, error } = useQuery(GET_POSTS, {
    variables: { limit: 10 },
  });

  return <div>{data?.posts.map((p) => <p key={p.id}>{p.title}</p>)}</div>;
}

// Mutation + 乐观更新
const CREATE_POST = gql`
  mutation CreatePost($title: String!) {
    createPost(title: $title) {
      id
      title
    }
  }
`;

function CreatePost() {
  const [createPost, { loading }] = useMutation(CREATE_POST, {
    optimisticResponse: {
      createPost: { id: 'temp-id', title: 'Optimistic Title', __typename: 'Post' },
    },
    update(cache, { data: { createPost } }) {
      cache.modify({
        fields: {
          posts(existingPosts = []) {
            const newPostRef = cache.writeFragment({
              data: createPost,
              fragment: gql`fragment NewPost on Post { id title }`,
            });
            return [...existingPosts, newPostRef];
          },
        },
      });
    },
  });

  return <button onClick={() => createPost({ variables: { title: 'New' } })}>Create</button>;
}
```

## 3. 服务端状态选型

| 维度 | TanStack Query | SWR | Apollo Client |
|------|---------------|-----|---------------|
| 协议 | REST / 任意 | REST / 任意 | GraphQL |
| 大小 | ~12KB | ~4KB | ~30KB |
| DevTools | ✅ 优秀 | ❌ 无 | ✅ Chrome 插件 |
| Infinite Query | ✅ | ⚠️ 手动 | ✅ |
| 乐观更新 | ✅ | ✅ | ✅ |
| 离线支持 | ✅ | ✅ | ✅ |
| 适用 | 中大型项目 | 小型项目 | GraphQL 项目 |
