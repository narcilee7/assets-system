# URL 状态管理

## 1. 为什么 URL 也是状态

```
URL 状态的优势：
├─ 刷新页面后保留
├─ 可分享链接
├─ 浏览器前进/后退正常工作
├─ 可服务端预渲染
├─ 可搜索引擎索引
└─ 用户可书签收藏

URL 状态适合：筛选、排序、页码、搜索词、标签页、模态框开关
```

## 2. React Router 的 URL 状态

```tsx
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';

function ProductList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // 读取
  const category = searchParams.get('category') || 'all';
  const sort = searchParams.get('sort') || 'default';
  const page = Number(searchParams.get('page')) || 1;

  // 更新（会替换当前 URL）
  const setCategory = (cat: string) => {
    setSearchParams({ category: cat, page: '1' });  // 重置页码
  };

  // 复杂更新
  const updateFilters = (filters: Record<string, string>) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(filters).forEach(([key, value]) => {
      if (value) newParams.set(key, value);
      else newParams.delete(key);
    });
    setSearchParams(newParams);
  };

  return (
    <div>
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="all">All</option>
        <option value="electronics">Electronics</option>
      </select>
      <p>Page: {page}</p>
    </div>
  );
}
```

## 3. Nuqs（类型安全的 URL 状态）

```tsx
import { useQueryState, parseAsInteger, parseAsStringEnum } from 'nuqs';

function ProductList() {
  // 类型安全 + 默认值
  const [page, setPage] = useQueryState(
    'page',
    parseAsInteger.withDefault(1)
  );

  const [sort, setSort] = useQueryState(
    'sort',
    parseAsStringEnum(['price_asc', 'price_desc', 'name']).withDefault('name')
  );

  // URL: /products?page=2&sort=price_asc
  // page: number = 2
  // sort: 'price_asc' | 'price_desc' | 'name' = 'price_asc'

  return (
    <div>
      <button onClick={() => setPage(page + 1)}>Next Page</button>
      <button onClick={() => setSort('price_desc')}>Sort by Price</button>
    </div>
  );
}

// 数组参数
import { parseAsArrayOf, parseAsString } from 'nuqs';

const [tags, setTags] = useQueryState(
  'tags',
  parseAsArrayOf(parseAsString).withDefault([])
);
// URL: /products?tags=red&tags=blue
// tags: ['red', 'blue']
```

## 4. URL 状态设计原则

```tsx
// ✅ 放入 URL：影响页面内容、用户可能分享
// - 筛选条件
// - 排序方式
// - 页码
// - 搜索关键词
// - 标签/分类
// - 模态框内容 ID

// ❌ 不放入 URL：临时状态、用户偏好
// - 加载状态
// - hover 状态
// - toast 通知
// - 表单输入中（提交后才放入 URL）
// - 用户主题偏好（放 localStorage）

// ⚠️ 敏感信息不要放 URL
// - 用户 token
// - 个人隐私数据
// - 支付相关信息
```
