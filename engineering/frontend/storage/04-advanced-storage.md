# 高级存储

## 1. OPFS（Origin Private File System）

```javascript
// OPFS 高性能文件操作

class OPFSStorage {
  private root: FileSystemDirectoryHandle | null = null;

  async init() {
    this.root = await navigator.storage.getDirectory();
  }

  // 写入大文件
  async writeFile(path: string, data: Blob | string | ArrayBuffer): Promise<void> {
    if (!this.root) throw new Error('Not initialized');

    const parts = path.split('/');
    const fileName = parts.pop()!;
    let dir = this.root;

    for (const part of parts) {
      if (part) {
        dir = await dir.getDirectoryHandle(part, { create: true });
      }
    }

    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();

    if (typeof data === 'string') {
      await writable.write(new TextEncoder().encode(data));
    } else {
      await writable.write(data);
    }

    await writable.close();
  }

  // 流式写入（适合大文件）
  async writeStream(path: string, stream: ReadableStream): Promise<void> {
    if (!this.root) throw new Error('Not initialized');

    const fileHandle = await this.getFileHandle(path, true);
    const writable = await fileHandle.createWritable();

    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await writable.write(value);
    }

    await writable.close();
  }

  // 读取文件
  async readFile(path: string): Promise<File> {
    const fileHandle = await this.getFileHandle(path, false);
    return fileHandle.getFile();
  }

  // 流式读取
  async readStream(path: string): Promise<ReadableStream> {
    const file = await this.readFile(path);
    return file.stream();
  }

  // 分片读取（适合超大文件）
  async readChunk(path: string, offset: number, size: number): Promise<ArrayBuffer> {
    const file = await this.readFile(path);
    return file.slice(offset, offset + size).arrayBuffer();
  }

  // 删除
  async deleteFile(path: string): Promise<void> {
    if (!this.root) throw new Error('Not initialized');

    const parts = path.split('/');
    const fileName = parts.pop()!;
    let dir = this.root;

    for (const part of parts) {
      if (part) {
        dir = await dir.getDirectoryHandle(part);
      }
    }

    await dir.removeEntry(fileName);
  }

  // 遍历目录
  async *walk(dirPath = ''): AsyncGenerator<{ path: string; kind: string; size?: number }> {
    if (!this.root) return;

    let dir = this.root;
    if (dirPath) {
      const parts = dirPath.split('/');
      for (const part of parts) {
        if (part) dir = await dir.getDirectoryHandle(part);
      }
    }

    for await (const [name, handle] of dir.entries()) {
      const path = dirPath ? `${dirPath}/${name}` : name;
      if (handle.kind === 'directory') {
        yield { path, kind: 'directory' };
        yield* this.walk(path);
      } else {
        const file = await handle.getFile();
        yield { path, kind: 'file', size: file.size };
      }
    }
  }

  private async getFileHandle(path: string, create: boolean): Promise<FileSystemFileHandle> {
    if (!this.root) throw new Error('Not initialized');

    const parts = path.split('/');
    const fileName = parts.pop()!;
    let dir = this.root;

    for (const part of parts) {
      if (part) {
        dir = await dir.getDirectoryHandle(part, { create });
      }
    }

    return dir.getFileHandle(fileName, { create });
  }
}

// 使用：处理 GB 级文件
const storage = new OPFSStorage();
await storage.init();

// 写入 1GB 文件
const bigData = new Blob([new ArrayBuffer(1024 * 1024 * 1024)]);
await storage.writeFile('large.bin', bigData);

// 流式处理
const stream = await storage.readStream('large.bin');
const reader = stream.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  // 处理 64KB chunk
  console.log('Chunk size:', value.byteLength);
}
```

## 2. File System Access API

```javascript
// 用户授权的文件系统访问（需要用户交互触发）

class FileSystemAccess {
  // 打开文件选择器
  async openFile(options: OpenFilePickerOptions = {}): Promise<FileSystemFileHandle[]> {
    const handles = await window.showOpenFilePicker({
      types: [
        { description: 'Images', accept: { 'image/*': ['.png', '.jpg', '.jpeg'] } },
        { description: 'Text', accept: { 'text/plain': ['.txt'] } },
      ],
      multiple: true,
      ...options,
    });
    return handles;
  }

  // 保存文件
  async saveFile(data: Blob | string, suggestedName?: string): Promise<void> {
    const handle = await window.showSaveFilePicker({
      suggestedName,
      types: [
        { description: 'JSON', accept: { 'application/json': ['.json'] } },
        { description: 'Text', accept: { 'text/plain': ['.txt'] } },
      ],
    });

    const writable = await handle.createWritable();
    await writable.write(data);
    await writable.close();
  }

  // 选择目录
  async selectDirectory(): Promise<FileSystemDirectoryHandle> {
    const handle = await window.showDirectoryPicker({
      mode: 'readwrite',
    });
    return handle;
  }

  // 请求持久化权限
  async requestPermission(handle: FileSystemHandle): Promise<PermissionState> {
    const options: FileSystemHandlePermissionDescriptor = { mode: 'readwrite' };

    if ((await handle.queryPermission(options)) === 'granted') {
      return 'granted';
    }

    return handle.requestPermission(options);
  }
}
```

## 3. SQLite WASM

```javascript
// sqlite-wasm 使用

import { createDbWorker } from 'sqlite-wasm-esm';

class SQLiteStorage {
  private worker: any;
  private db: any;

  async init() {
    this.worker = await createDbWorker();
    this.db = await this.worker.open(':memory:');  // 内存数据库
    // 或持久化到 OPFS
    // this.db = await this.worker.open('file:mydb.db?vfs=opfs');
  }

  async exec(sql: string, params?: any[]): Promise<any[]> {
    return this.db.exec(sql, params);
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.db.exec('BEGIN TRANSACTION');
    try {
      const result = await fn();
      await this.db.exec('COMMIT');
      return result;
    } catch (error) {
      await this.db.exec('ROLLBACK');
      throw error;
    }
  }

  async close() {
    await this.db.close();
    this.worker.terminate();
  }
}

// 使用
const sqlite = new SQLiteStorage();
await sqlite.init();

await sqlite.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE
  )
`);

await sqlite.exec('INSERT INTO users (name, email) VALUES (?, ?)', ['Alice', 'alice@example.com']);

const users = await sqlite.exec('SELECT * FROM users WHERE name = ?', ['Alice']);
console.log(users);
```

## 4. 大数据处理策略

```typescript
// 大数据分片存储

class ChunkedStorage {
  private chunkSize = 1024 * 1024; // 1MB

  constructor(private storage: OPFSStorage) {}

  async writeLargeFile(key: string, data: ArrayBuffer): Promise<void> {
    const totalChunks = Math.ceil(data.byteLength / this.chunkSize);

    // 写入元数据
    await this.storage.writeFile(`${key}.meta`, JSON.stringify({
      totalChunks,
      totalSize: data.byteLength,
      chunkSize: this.chunkSize,
      created: Date.now(),
    }));

    // 分片写入
    for (let i = 0; i < totalChunks; i++) {
      const offset = i * this.chunkSize;
      const chunk = data.slice(offset, offset + this.chunkSize);
      await this.storage.writeFile(`${key}.chunk.${i}`, chunk);
    }
  }

  async readLargeFile(key: string): Promise<ArrayBuffer> {
    const metaFile = await this.storage.readFile(`${key}.meta`);
    const meta = JSON.parse(await metaFile.text());

    const chunks: ArrayBuffer[] = [];
    for (let i = 0; i < meta.totalChunks; i++) {
      const chunkFile = await this.storage.readFile(`${key}.chunk.${i}`);
      chunks.push(await chunkFile.arrayBuffer());
    }

    // 合并
    const result = new Uint8Array(meta.totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }

    return result.buffer;
  }

  async streamLargeFile(key: string): Promise<ReadableStream> {
    const metaFile = await this.storage.readFile(`${key}.meta`);
    const meta = JSON.parse(await metaFile.text());

    let currentChunk = 0;

    return new ReadableStream({
      pull: async (controller) => {
        if (currentChunk >= meta.totalChunks) {
          controller.close();
          return;
        }

        const chunkFile = await this.storage.readFile(`${key}.chunk.${currentChunk}`);
        const buffer = await chunkFile.arrayBuffer();
        controller.enqueue(new Uint8Array(buffer));
        currentChunk++;
      },
    });
  }
}
```
