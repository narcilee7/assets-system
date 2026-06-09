# gRPC Service

gRPC 是 Google 开源的高性能 RPC 框架，基于 HTTP/2 和 Protocol Buffers，适合微服务间的高效通信。

## 核心优势

| 维度 | gRPC | REST |
| --- | --- | --- |
| 协议 | HTTP/2 + Protobuf | HTTP/1.1 + JSON |
| 序列化 | 二进制、紧凑 | 文本、冗余 |
| 性能 | 高（少 50-70% 带宽） | 中 |
| 类型安全 | 强（proto 定义） | 弱（运行时解析） |
| 流 | 双向流、服务端流 | 需 SSE / WebSocket |
| 浏览器 | 需 gRPC-Web | 原生支持 |

## 核心实现

### 1. Protocol Buffer 定义

```proto
// protos/order.proto
syntax = "proto3";

package orders;

service OrderService {
  rpc GetOrder(GetOrderRequest) returns (Order);
  rpc ListOrders(ListOrdersRequest) returns (stream Order); // 服务端流
  rpc CreateOrders(stream CreateOrderRequest) returns (OrderSummary); // 客户端流
  rpc StreamOrders(stream OrderUpdate) returns (stream OrderUpdate); // 双向流
}

message GetOrderRequest {
  string id = 1;
}

message Order {
  string id = 1;
  string user_id = 2;
  double amount = 3;
  string status = 4;
}

message ListOrdersRequest {
  string user_id = 1;
  int32 page = 2;
  int32 limit = 3;
}

message CreateOrderRequest {
  string user_id = 1;
  double amount = 2;
}

message OrderSummary {
  int32 count = 1;
  double total = 2;
}

message OrderUpdate {
  string order_id = 1;
  string status = 2;
}
```

### 2. gRPC Server

```ts
// server.ts
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

const packageDefinition = protoLoader.loadSync(
  path.join(__dirname, '../protos/order.proto'),
  { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
);

const ordersProto = grpc.loadPackageDefinition(packageDefinition).orders as any;

const ordersDb = new Map<string, any>();

const orderService = {
  getOrder: (call: any, callback: any) => {
    const order = ordersDb.get(call.request.id);
    if (!order) {
      callback({ code: grpc.status.NOT_FOUND, message: 'Order not found' });
      return;
    }
    callback(null, order);
  },

  listOrders: (call: any) => {
    const { user_id } = call.request;
    for (const order of ordersDb.values()) {
      if (order.user_id === user_id) {
        call.write(order);
      }
    }
    call.end();
  },

  createOrders: (call: any, callback: any) => {
    let count = 0;
    let total = 0;
    call.on('data', (req: any) => {
      const id = crypto.randomUUID();
      const order = { id, user_id: req.user_id, amount: req.amount, status: 'pending' };
      ordersDb.set(id, order);
      count++;
      total += req.amount;
    });
    call.on('end', () => {
      callback(null, { count, total });
    });
  },

  streamOrders: (call: any) => {
    call.on('data', (update: any) => {
      const order = ordersDb.get(update.order_id);
      if (order) {
        order.status = update.status;
        call.write(order);
      }
    });
    call.on('end', () => call.end());
  },
};

const server = new grpc.Server();
server.addService(ordersProto.OrderService.service, orderService);
server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), () => {
  console.log('gRPC server on :50051');
  server.start();
});
```

### 3. gRPC Client

```ts
// client.ts
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

const packageDefinition = protoLoader.loadSync(
  path.join(__dirname, '../protos/order.proto'),
  { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
);

const ordersProto = grpc.loadPackageDefinition(packageDefinition).orders as any;

const client = new ordersProto.OrderService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

// 一元调用
client.getOrder({ id: '123' }, (err: any, response: any) => {
  if (err) return console.error(err);
  console.log(response);
});

// 服务端流
const stream = client.listOrders({ user_id: 'user-1' });
stream.on('data', (order: any) => console.log('Order:', order));
stream.on('end', () => console.log('Stream ended'));
```

### 4. Interceptor（中间件）

```ts
// interceptor.ts
const authInterceptor: grpc.ClientInterceptor = (options, nextCall) => {
  return new grpc.InterceptingCall(nextCall(options), {
    start: (metadata, listener, next) => {
      metadata.add('authorization', `Bearer ${process.env.GRPC_TOKEN}`);
      next(metadata, listener);
    },
  });
};
```

## 生产要点

- 使用 `grpc.health.v1.Health` 实现健康检查。
- 连接使用 `grpc.Client` 连接池，单个连接复用多个请求（HTTP/2 多路复用）。
- 超时：每个调用设置 `deadline`（`new Date(Date.now() + 5000)`）。
- 重试：使用 `grpc-js` 的 retry policy 或服务网格（Istio）实现。
- 负载均衡：使用 DNS 轮询或 Kubernetes Headless Service + gRPC LB。
