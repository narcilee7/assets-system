# Go gRPC 服务构建

gRPC 是 Google 开源的高性能 RPC 框架，基于 HTTP/2 和 Protocol Buffers。在 Go 生态中，gRPC 是微服务间通信的事实标准，支持四种服务类型：Unary（一元）、Server Streaming、Client Streaming 和 Bidirectional Streaming。相比 REST/JSON，gRPC 在延迟、吞吐量和类型安全方面都有显著优势，且原生支持流式处理和负载均衡。

## 核心概念

Protocol Buffers（protobuf）是 gRPC 的接口定义语言（IDL），通过 `.proto` 文件描述服务接口和消息结构，再用 `protoc` 编译生成 Go 代码。protobuf 使用二进制编码，序列化性能比 JSON 高 5-10 倍，且生成的 Go 结构体是强类型的。

gRPC 基于 HTTP/2，支持多路复用（单个 TCP 连接处理多个请求）、头部压缩和流控。Go 的 gRPC 实现利用 goroutine 处理每个 RPC 调用，streaming 场景下每个流对应独立的 goroutine，天然高效。

## 代码实现

```protobuf
// api/order.proto
syntax = "proto3";
package order;
option go_package = "myapp/api/order;orderpb";

service OrderService {
  rpc CreateOrder(CreateOrderRequest) returns (CreateOrderResponse);
  rpc GetOrder(GetOrderRequest) returns (Order);
  rpc StreamOrders(StreamOrdersRequest) returns (stream Order);
  rpc BatchCreateOrders(stream CreateOrderRequest) returns (BatchCreateResponse);
}

message CreateOrderRequest {
  string user_id = 1;
  string product_id = 2;
  int32 quantity = 3;
  double price = 4;
}

message CreateOrderResponse {
  string order_id = 1;
  string status = 2;
}

message GetOrderRequest {
  string order_id = 1;
}

message Order {
  string order_id = 1;
  string user_id = 2;
  string product_id = 3;
  int32 quantity = 4;
  double price = 5;
  string status = 6;
  int64 created_at = 7;
}

message StreamOrdersRequest {
  string user_id = 1;
}

message BatchCreateResponse {
  int32 created_count = 1;
  repeated string order_ids = 2;
}
```

```go
// server.go
package grpcserver

import (
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"myapp/api/order/orderpb"
)

// OrderServer 实现 gRPC 服务
type OrderServer struct {
	orderpb.UnimplementedOrderServiceServer
	repo OrderRepository
}

func NewOrderServer(repo OrderRepository) *OrderServer {
	return &OrderServer{repo: repo}
}

// CreateOrder Unary RPC
func (s *OrderServer) CreateOrder(ctx context.Context, req *orderpb.CreateOrderRequest) (*orderpb.CreateOrderResponse, error) {
	// 从 context 提取 metadata（如 trace_id、auth token）
	md, ok := metadata.FromIncomingContext(ctx)
	if ok {
		log.Printf("trace_id: %v", md.Get("x-trace-id"))
	}

	// 参数校验
	if req.UserId == "" || req.ProductId == "" {
		return nil, status.Error(codes.InvalidArgument, "user_id and product_id are required")
	}

	order := &Order{
		ID:        generateID(),
		UserID:    req.UserId,
		ProductID: req.ProductId,
		Quantity:  int(req.Quantity),
		Price:     req.Price,
		Status:    "pending",
		CreatedAt: time.Now(),
	}

	if err := s.repo.Save(ctx, order); err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &orderpb.CreateOrderResponse{
		OrderId: order.ID,
		Status:  order.Status,
	}, nil
}

// StreamOrders Server Streaming RPC
func (s *OrderServer) StreamOrders(req *orderpb.StreamOrdersRequest, stream orderpb.OrderService_StreamOrdersServer) error {
	orders, err := s.repo.ListByUser(stream.Context(), req.UserId)
	if err != nil {
		return status.Error(codes.Internal, err.Error())
	}

	for _, o := range orders {
		if err := stream.Send(toProtoOrder(o)); err != nil {
			return err
		}
		// 模拟流控
		time.Sleep(10 * time.Millisecond)
	}
	return nil
}

// BatchCreateOrders Client Streaming RPC
func (s *OrderServer) BatchCreateOrders(stream orderpb.OrderService_BatchCreateOrdersServer) error {
	var orderIDs []string
	for {
		req, err := stream.Recv()
		if err == io.EOF {
			return stream.SendAndClose(&orderpb.BatchCreateResponse{
				CreatedCount: int32(len(orderIDs)),
				OrderIds:     orderIDs,
			})
		}
		if err != nil {
			return err
		}

		order := &Order{
			ID:        generateID(),
			UserID:    req.UserId,
			ProductID: req.ProductId,
			Quantity:  int(req.Quantity),
			Price:     req.Price,
			Status:    "pending",
		}
		if err := s.repo.Save(stream.Context(), order); err != nil {
			return err
		}
		orderIDs = append(orderIDs, order.ID)
	}
}

func toProtoOrder(o *Order) *orderpb.Order {
	return &orderpb.Order{
		OrderId:   o.ID,
		UserId:    o.UserID,
		ProductId: o.ProductID,
		Quantity:  int32(o.Quantity),
		Price:     o.Price,
		Status:    o.Status,
		CreatedAt: o.CreatedAt.Unix(),
	}
}

func generateID() string {
	return fmt.Sprintf("ORD-%d", time.Now().UnixNano())
}

// NewGRPCServer 创建并配置 gRPC 服务器
func NewGRPCServer(tlsCred credentials.TransportCredentials) *grpc.Server {
	opts := []grpc.ServerOption{
		grpc.UnaryInterceptor(unaryInterceptor),
		grpc.StreamInterceptor(streamInterceptor),
		grpc.MaxRecvMsgSize(10 * 1024 * 1024), // 10MB
		grpc.MaxSendMsgSize(10 * 1024 * 1024),
	}
	if tlsCred != nil {
		opts = append(opts, grpc.Creds(tlsCred))
	}
	return grpc.NewServer(opts...)
}

func unaryInterceptor(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
	start := time.Now()
	resp, err := handler(ctx, req)
	log.Printf("[gRPC] method=%s duration=%s err=%v", info.FullMethod, time.Since(start), err)
	return resp, err
}

func streamInterceptor(srv interface{}, ss grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
	start := time.Now()
	err := handler(srv, ss)
	log.Printf("[gRPC] stream=%s duration=%s err=%v", info.FullMethod, time.Since(start), err)
	return err
}
```

```go
// client.go
package grpcclient

import (
	"context"
	"crypto/tls"
	"fmt"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"myapp/api/order/orderpb"
)

func NewOrderClient(addr string, useTLS bool) (orderpb.OrderServiceClient, error) {
	var creds credentials.TransportCredentials
	if useTLS {
		var err error
		creds, err = credentials.NewClientTLSFromFile("server.crt", "")
		if err != nil {
			return nil, err
		}
	} else {
		creds = insecure.NewCredentials()
	}

	conn, err := grpc.Dial(addr,
		grpc.WithTransportCredentials(creds),
		grpc.WithDefaultServiceConfig(`{"loadBalancingConfig": [{"round_robin":{}}]}`),
		grpc.WithUnaryInterceptor(clientUnaryInterceptor),
		grpc.WithBlock(),
		grpc.WithTimeout(5*time.Second),
	)
	if err != nil {
		return nil, fmt.Errorf("dial: %w", err)
	}

	return orderpb.NewOrderServiceClient(conn), nil
}

func clientUnaryInterceptor(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
	// 注入 trace_id
	traceID := ctx.Value("trace_id")
	if traceID != nil {
		ctx = metadata.AppendToOutgoingContext(ctx, "x-trace-id", traceID.(string))
	}
	return invoker(ctx, method, req, reply, cc, opts...)
}

// 使用示例
func ExampleUsage(client orderpb.OrderServiceClient) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	resp, err := client.CreateOrder(ctx, &orderpb.CreateOrderRequest{
		UserId:    "user-123",
		ProductId: "prod-456",
		Quantity:  2,
		Price:     99.99,
	})
	if err != nil {
		st, _ := status.FromError(err)
		fmt.Printf("Error: code=%s message=%s\n", st.Code(), st.Message())
		return
	}
	fmt.Printf("Created order: %s\n", resp.OrderId)
}
```

## 选型对比

| 方案 | 协议 | 性能 | 类型安全 | 流式 | 浏览器 | 适用场景 |
| --- | --- | --- | --- | --- | --- | --- |
| gRPC | HTTP/2 + protobuf | ⭐⭐⭐ | ✅ | ✅ | ❌（需 grpc-web） | **微服务首选** |
| gRPC-Web | HTTP/1.1 fallback | ⭐⭐ | ✅ | 有限 | ✅ | 前端调用 gRPC |
| Connect | HTTP/1.1 + 二进制/JSON | ⭐⭐ | ✅ | ✅ | ✅ | 全栈统一 |
| REST/JSON | HTTP/1.1 | ⭐⭐ | ❌ | ❌ | ✅ | 公网 API、第三方集成 |
| Thrift | TCP/HTTP | ⭐⭐⭐ | ✅ | ✅ | ❌ | 与 Java/C++ 互通 |

## 最佳实践

- **错误码映射**：gRPC Status Code 映射到业务错误码，不要所有错误都返回 `Internal`
- **Deadline 传播**：上游请求设置 timeout，通过 context 传递给下游 gRPC 调用
- **连接池**：gRPC 连接是长连接，客户端应复用 `*grpc.ClientConn`，不要每次调用新建
- **Health Check**：实现 gRPC Health Checking Protocol，配合 K8s 探针
- **拦截器链**：使用 `grpc-middleware` 组合认证、日志、恢复、重试等拦截器
- **消息大小**：根据业务设置 `MaxRecvMsgSize` 和 `MaxSendMsgSize`，防止 OOM
- **TLS 双向认证**：服务间通信使用 mTLS，结合 SPIFFE/SPIRE 做服务身份认证
