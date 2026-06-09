# 数据流架构

## 1. 单向数据流

```
Redux 风格单向数据流：

User Action
  ↓
Action Creator → { type: 'ADD_TODO', payload: 'Buy milk' }
  ↓
Reducer → (state, action) => newState
  ↓
Store → 保存新状态
  ↓
Selector → 派生数据
  ↓
UI Component → 重新渲染
```

```typescript
// 现代简化版（Zustand + Immer）
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface TodoStore {
  todos: Todo[];
  addTodo: (text: string) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
}

const useTodoStore = create<TodoStore>()(
  immer((set) => ({
    todos: [],
    addTodo: (text) =>
      set((draft) => {
        draft.todos.push({ id: crypto.randomUUID(), text, done: false });
      }),
    toggleTodo: (id) =>
      set((draft) => {
        const todo = draft.todos.find((t) => t.id === id);
        if (todo) todo.done = !todo.done;
      }),
    deleteTodo: (id) =>
      set((draft) => {
        draft.todos = draft.todos.filter((t) => t.id !== id);
      }),
  }))
);
```

## 2. CQRS（命令查询职责分离）

```typescript
// 读和写分离

// 写模型（Commands）
interface CreateOrderCommand {
  type: 'CREATE_ORDER';
  payload: { userId: string; items: CartItem[] };
}

interface CancelOrderCommand {
  type: 'CANCEL_ORDER';
  payload: { orderId: string; reason: string };
}

// 命令处理器
class OrderCommandHandler {
  async handle(command: CreateOrderCommand | CancelOrderCommand) {
    switch (command.type) {
      case 'CREATE_ORDER':
        return this.createOrder(command.payload);
      case 'CANCEL_ORDER':
        return this.cancelOrder(command.payload);
    }
  }
}

// 读模型（Queries）
interface GetOrderQuery {
  orderId: string;
}

interface ListOrdersQuery {
  userId: string;
  status?: OrderStatus;
  page: number;
}

// 查询处理器
class OrderQueryHandler {
  async getOrder(query: GetOrderQuery): Promise<Order> {
    return db.orders.findById(query.orderId);
  }

  async listOrders(query: ListOrdersQuery): Promise<Order[]> {
    return db.orders.find({
      userId: query.userId,
      status: query.status,
      skip: (query.page - 1) * 20,
      take: 20,
    });
  }
}
```

## 3. Event Sourcing

```typescript
// 事件溯源：状态是事件的聚合

// 事件定义
interface Event {
  id: string;
  type: string;
  payload: unknown;
  timestamp: number;
  aggregateId: string;
}

interface TodoCreatedEvent extends Event {
  type: 'TODO_CREATED';
  payload: { id: string; text: string };
}

interface TodoCompletedEvent extends Event {
  type: 'TODO_COMPLETED';
  payload: { id: string };
}

// 聚合根：从事件重建状态
class TodoAggregate {
  private events: Event[] = [];
  private state: TodoState = { todos: [] };

  applyEvent(event: Event) {
    switch (event.type) {
      case 'TODO_CREATED':
        this.state.todos.push({
          id: event.payload.id,
          text: event.payload.text,
          done: false,
        });
        break;
      case 'TODO_COMPLETED':
        const todo = this.state.todos.find((t) => t.id === event.payload.id);
        if (todo) todo.done = true;
        break;
    }
    this.events.push(event);
  }

  replay(events: Event[]) {
    this.state = { todos: [] };
    this.events = [];
    for (const event of events) {
      this.applyEvent(event);
    }
  }

  createTodo(text: string): TodoCreatedEvent {
    return {
      id: crypto.randomUUID(),
      type: 'TODO_CREATED',
      payload: { id: crypto.randomUUID(), text },
      timestamp: Date.now(),
      aggregateId: 'todo-list',
    };
  }

  getState() {
    return this.state;
  }
}

// 使用
const todoList = new TodoAggregate();
todoList.applyEvent(todoList.createTodo('Buy milk'));
todoList.applyEvent(todoList.createTodo('Walk dog'));

// 可以重放所有事件重建状态
const events = [...todoList.events];
const reconstructed = new TodoAggregate();
reconstructed.replay(events);
console.log(reconstructed.getState());  // 相同状态
```

## 4. 命令模式

```typescript
// 命令模式：将操作封装为对象，支持撤销/重做

interface Command {
  execute(): void;
  undo(): void;
  redo(): void;
}

class CanvasEditor {
  private history: Command[] = [];
  private redoStack: Command[] = [];

  execute(command: Command) {
    command.execute();
    this.history.push(command);
    this.redoStack = [];  // 新操作清空 redo 栈
  }

  undo() {
    const command = this.history.pop();
    if (command) {
      command.undo();
      this.redoStack.push(command);
    }
  }

  redo() {
    const command = this.redoStack.pop();
    if (command) {
      command.redo();
      this.history.push(command);
    }
  }
}

// 具体命令
class DrawShapeCommand implements Command {
  constructor(
    private canvas: CanvasRenderingContext2D,
    private shape: Shape,
    private prevImage: ImageData
  ) {}

  execute() {
    this.shape.draw(this.canvas);
  }

  undo() {
    this.canvas.putImageData(this.prevImage, 0, 0);
  }

  redo() {
    this.execute();
  }
}
```
