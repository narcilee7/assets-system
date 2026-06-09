# Python gRPC Service

gRPC 在 Python 中通过 grpcio 实现，适合高性能内部服务通信。

## 定义 Protobuf

```protobuf
// user.proto
syntax = "proto3";

service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc ListUsers(ListUsersRequest) returns (stream User);
}

message GetUserRequest {
  int32 id = 1;
}

message User {
  int32 id = 1;
  string name = 2;
  string email = 3;
}

message ListUsersRequest {
  int32 page = 1;
  int32 page_size = 2;
}
```

## Server

```python
# server.py
import grpc
from concurrent import futures
import user_pb2
import user_pb2_grpc

class UserServicer(user_pb2_grpc.UserServiceServicer):
    def GetUser(self, request, context):
        return user_pb2.User(id=request.id, name="Alice", email="alice@example.com")
    
    def ListUsers(self, request, context):
        for i in range(request.page_size):
            yield user_pb2.User(id=i, name=f"User {i}")

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    user_pb2_grpc.add_UserServiceServicer_to_server(UserServicer(), server)
    server.add_insecure_port('[::]:50051')
    server.start()
    server.wait_for_termination()

if __name__ == '__main__':
    serve()
```

## Client

```python
# client.py
import grpc
import user_pb2
import user_pb2_grpc

channel = grpc.insecure_channel('localhost:50051')
stub = user_pb2_grpc.UserServiceStub(channel)

#  Unary
response = stub.GetUser(user_pb2.GetUserRequest(id=1))
print(response)

# Streaming
for user in stub.ListUsers(user_pb2.ListUsersRequest(page=1, page_size=10)):
    print(user)
```

## 生成代码

```bash
python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. user.proto
```
