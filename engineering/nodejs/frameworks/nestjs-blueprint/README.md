# NestJS Modular Service Blueprint

NestJS 是企业级 Node.js 的首选框架。本蓝图展示模块、依赖注入、拦截器、管道和异常过滤器的生产级组合。

## 目录结构

```
nestjs-blueprint/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/
│   │   └── database.config.ts
│   ├── common/
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   ├── interceptors/
│   │   │   └── logging.interceptor.ts
│   │   └── pipes/
│   │       └── validation.pipe.ts
│   └── modules/
│       └── order/
│           ├── order.module.ts
│           ├── order.controller.ts
│           ├── order.service.ts
│           ├── order.repository.ts
│           └── dto/
│               ├── create-order.dto.ts
│               └── order-response.dto.ts
```

## 核心文件

### main.ts

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  await app.listen(3000);
}
bootstrap();
```

### 模块定义

```ts
// modules/order/order.module.ts
import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderRepository } from './order.repository';

@Module({
  controllers: [OrderController],
  providers: [OrderService, OrderRepository],
  exports: [OrderService],
})
export class OrderModule {}
```

### 分层服务

```ts
// modules/order/order.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderRepository } from './order.repository';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';

@Injectable()
export class OrderService {
  constructor(private readonly repo: OrderRepository) {}

  async create(dto: CreateOrderDto): Promise<OrderResponseDto> {
    return this.repo.create(dto);
  }

  async findOne(id: string): Promise<OrderResponseDto> {
    const order = await this.repo.findById(id);
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }
}
```

### 异常过滤器

```ts
// common/filters/http-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    this.logger.error(
      {
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        response: exceptionResponse,
      },
      exception.stack,
    );

    response.status(status).json({
      code: (exceptionResponse as any)?.code || 'HTTP_ERROR',
      message: (exceptionResponse as any)?.message || exception.message,
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### 日志拦截器

```ts
// common/interceptors/logging.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.logger.log(`${method} ${url} ${Date.now() - now}ms`);
      }),
    );
  }
}
```

## 选型建议

| 场景 | 推荐 |
| --- | --- |
| 快速原型 / 简单 API | Express / Fastify |
| 企业级 CRUD 服务 | NestJS |
| 极致性能 | Fastify + 原生插件 |
| Edge / Serverless | Hono |
| 全栈 Next.js | Next API Routes |
