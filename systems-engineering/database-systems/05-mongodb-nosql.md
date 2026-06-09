# MongoDB 工程化

## 1. 文档模型设计

```
MongoDB 设计原则

嵌入式 vs 引用式

嵌入式（子文档）
├── 优点：一次查询获取完整数据、原子更新
├── 缺点：文档大小限制 16MB、数据冗余
├── 适用：一对一、一对少、经常一起查询
└── 示例：订单中的商品列表

引用式（DBRef / 手动引用）
├── 优点：避免冗余、文档更小
├── 缺点：需要多次查询或 $lookup JOIN
├── 适用：一对多、多对多、经常独立查询
└── 示例：用户和订单分开存储

设计原则
├── 优先考虑查询模式，而非规范化
├── 避免深层嵌套（最多 3-4 层）
├── 数组不要无限增长（100 个元素以内）
├── 使用固定大小的数组（capped array）
└── 为大数组建立索引时要谨慎
```

```javascript
// 嵌入式：订单包含商品
{
  _id: ObjectId("..."),
  user_id: 1,
  items: [
    { product_id: 101, name: "iPhone", price: 999, qty: 1 },
    { product_id: 102, name: "AirPods", price: 199, qty: 2 }
  ],
  total: 1397,
  status: "paid",
  created_at: ISODate("2024-06-08")
}

// 引用式：博客文章和评论分开
// posts collection
{ _id: 1, title: "Hello", content: "..." }

// comments collection
{ _id: 1, post_id: 1, author: "Alice", text: "Great!" }
```

## 2. 索引

```javascript
// 单字段索引
db.users.createIndex({ email: 1 }, { unique: true });

// 复合索引
db.orders.createIndex({ user_id: 1, created_at: -1 });

// 多键索引（数组）
db.products.createIndex({ tags: 1 });

// 文本索引
db.articles.createIndex({ title: "text", content: "text" });
db.articles.find({ $text: { $search: "mongodb indexing" } });

// 地理空间索引
db.places.createIndex({ location: "2dsphere" });
db.places.find({
  location: {
    $near: {
      $geometry: { type: "Point", coordinates: [-73.97, 40.77] },
      $maxDistance: 1000
    }
  }
});

// 索引属性
db.collection.createIndex({ field: 1 }, {
  unique: true,        // 唯一索引
  sparse: true,        // 稀疏索引（只索引存在的字段）
  partialFilterExpression: { age: { $gte: 18 } },  // 部分索引
  expireAfterSeconds: 3600,  // TTL 索引
  background: true     // 后台创建
});
```

## 3. 聚合管道

```javascript
// 统计每个用户的订单总金额
db.orders.aggregate([
  { $match: { status: "paid" } },
  { $group: {
      _id: "$user_id",
      total_spent: { $sum: "$total" },
      order_count: { $sum: 1 }
  }},
  { $sort: { total_spent: -1 } },
  { $limit: 10 }
]);

// 关联查询（$lookup = LEFT JOIN）
db.orders.aggregate([
  { $match: { _id: 1 } },
  { $lookup: {
      from: "users",
      localField: "user_id",
      foreignField: "_id",
      as: "user"
  }},
  { $unwind: "$user" },  // 展开数组为对象
  { $project: {
      order_id: "$_id",
      user_name: "$user.name",
      total: 1
  }}
]);

// 时间窗口聚合（每小时订单数）
db.orders.aggregate([
  { $group: {
      _id: {
        year: { $year: "$created_at" },
        month: { $month: "$created_at" },
        day: { $dayOfMonth: "$created_at" },
        hour: { $hour: "$created_at" }
      },
      count: { $sum: 1 }
  }},
  { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.hour": 1 } }
]);
```

## 4. 副本集与分片

```
副本集（Replica Set）
├── 一主（Primary）+ 多从（Secondary）+ 仲裁（Arbiter）
├── 写操作：主库
├── 读操作：可配置（primary / primaryPreferred / secondary / nearest）
├── 自动故障转移（选举新主）
└── 配置：writeConcern（w: majority）、readConcern（majority / available）

分片（Sharding）
├── 数据水平拆分，分布到多个分片
├── 分片键选择：
│   ├── 高基数（避免热点）
│   ├── 查询频率高
│   └── 单调递增（如时间）不适合做分片键
├── 分片策略：
│   ├── 范围分片（Range）：适合范围查询
│   └── 哈希分片（Hash）：数据均匀分布
├── 均衡器（Balancer）：自动迁移 chunk
└── 缺点：跨分片查询慢、事务限制
```

```javascript
// 副本集配置
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "mongo1:27017" },
    { _id: 1, host: "mongo2:27017" },
    { _id: 2, host: "mongo3:27017", arbiterOnly: true }
  ]
});

// 分片启用
sh.enableSharding("mydb");
sh.shardCollection("mydb.orders", { user_id: "hashed" });

// 事务（4.0+ 副本集，4.2+ 分片）
const session = db.getMongo().startSession();
session.startTransaction();
try {
  session.getDatabase("mydb").orders.insertOne({ ... });
  session.getDatabase("mydb").inventory.updateOne({ ... });
  session.commitTransaction();
} catch (error) {
  session.abortTransaction();
}
```
