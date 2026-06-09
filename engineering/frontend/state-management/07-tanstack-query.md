# TanStack Query（React Query）

## 1. 核心思想

服务端状态 ≠ 客户端状态。

服务端状态的特征：
- 来自远程，有异步加载过程
- 需要缓存（避免重复请求）
- 需要失效策略（stale time, cache time）
- 需要去重（多个组件请求相同数据）
- 需要重试（网络失败自动重试）
- 需要乐观更新（mutation 后立即更新 UI）

```
Component A ──┐
              ├──-> Query Client ──> Cache ──> Server
Component B ──┘              (去重)    (命中缓存直接返回)
```

## 2. 基础用法

```tsx
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query';

// 1. 创建 QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5 分钟内数据视为新鲜
      cacheTime: 10 * 60 * 1000,  // 10 分钟后从缓存清除
      retry: 3,                   // 失败重试 3 次
      refetchOnWindowFocus: true, // 窗口聚焦时重新获取
    },
  },
});

// 2. 包裹应用
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MyApp />
    </QueryClientProvider>
  );
}

// 3. 使用 useQuery
function Posts() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['posts'],           // 缓存 key
    queryFn: fetchPosts,           // 数据获取函数
    select: (data) => data.slice(0, 10),  // 数据转换
  });

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data.map((post) => <PostCard key={post.id} post={post} />)}
      <button onClick={() => refetch()}>Refresh</button>
    </div>
  );
}
```

## 3. Query Key 设计

```tsx
// Query Key 是数组，支持任意可序列化值
// 设计原则：唯一标识一组数据

// ❌ 不好的 key
useQuery({ queryKey: ['posts'], queryFn: () => fetchPosts({ page, limit }) });

// ✅ 好的 key：包含所有影响数据的参数
useQuery({
  queryKey: ['posts', { page, limit, sort, filter }],
  queryFn: () => fetchPosts({ page, limit, sort, filter }),
});

// 更细粒度的 key（单个资源）
useQuery({ queryKey: ['post', postId], queryFn: () => fetchPost(postId) });
useQuery({ queryKey: ['comments', postId], queryFn: () => fetchComments(postId) });

// 使用 queryClient 手动操作缓存
queryClient.invalidateQueries({ queryKey: ['posts'] });  // 标记为 stale，下次使用时重新获取
queryClient.refetchQueries({ queryKey: ['posts'] });     // 立即重新获取
queryClient.setQueryData(['post', 1], (old) => ({ ...old, title: 'New Title' }));  // 直接修改缓存
queryClient.removeQueries({ queryKey: ['posts'] });      // 移除缓存
```

## 4. useMutation

```tsx
function CreatePost() {
  const mutation = useMutation({
    mutationFn: createPost,
    onSuccess: (data) => {
      // 创建成功后，使 posts 缓存失效
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      // 或乐观更新：直接添加新 post 到缓存
      queryClient.setQueryData(['posts'], (old) => [...old, data]);
    },
    onError: (error) => {
      toast.error(error.message);
    },
    onSettled: () => {
      // 无论成功失败都执行
    },
  });

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      mutation.mutate({ title, content });
    }}>
      <button disabled={mutation.isPending}>
        {mutation.isPending ? 'Creating...' : 'Create'}
      </button>
    </form>
  );
}
```

## 5. 乐观更新

```tsx
const mutation = useMutation({
  mutationFn: updateTodo,
  onMutate: async (newTodo) => {
    // 1. 取消正在进行的 refetch
    await queryClient.cancelQueries({ queryKey: ['todo', newTodo.id] });

    // 2. 保存旧值用于回滚
    const previousTodo = queryClient.getQueryData(['todo', newTodo.id]);

    // 3. 乐观更新：直接修改缓存
    queryClient.setQueryData(['todo', newTodo.id], newTodo);

    // 4. 返回 context（传给 onError）
    return { previousTodo };
  },
  onError: (err, newTodo, context) => {
    // 出错时回滚
    queryClient.setQueryData(['todo', newTodo.id], context.previousTodo);
  },
  onSettled: (newTodo) => {
    // 最后重新获取确认数据
    queryClient.invalidateQueries({ queryKey: ['todo', newTodo.id] });
  },
});
```

## 6. Infinite Query

```tsx
import { useInfiniteQuery } from '@tanstack/react-query';

function PostList() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['posts'],
    queryFn: ({ pageParam = 1 }) => fetchPosts({ page: pageParam, limit: 10 }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length + 1 : undefined,
    initialPageParam: 1,
  });

  const posts = data?.pages.flatMap((page) => page.posts) ?? [];

  return (
    <div>
      {posts.map((post) => <PostCard key={post.id} post={post} />)}
      <button
        onClick={() => fetchNextPage()}
        disabled={!hasNextPage || isFetchingNextPage}
      >
        {isFetchingNextPage ? 'Loading...' : 'Load More'}
      </button>
    </div>
  );
}
```
