# Build Graph and Cache

## 目标

理解构建系统的核心抽象：依赖图（Dependency Graph）、任务调度、构建缓存和分布式构建，以及 Make、Ninja、Bazel 的设计差异。

## 场景

- Make 的递归依赖为什么容易出错？
- Bazel 为什么能做到 hermetic build？
- 构建缓存 key 怎么设计才能最大化命中？
- 分布式构建中，编译任务怎么分发到远程机器？
- CMake 和 Ninja 是什么关系？

## 依赖图

### 有向无环图（DAG）

```
构建 = 将源文件转换为产物的有向无环图

        main.o
           │
    ┌──────┴──────┐
    ▼             ▼
 main.cpp      utils.o
                  │
           ┌──────┴──────┐
           ▼             ▼
        utils.cpp    helper.o
                        │
                        ▼
                     helper.cpp

边表示依赖：
  main.o 依赖 main.cpp 和 utils.o
  utils.o 依赖 utils.cpp 和 helper.o

构建顺序：拓扑排序
  1. helper.cpp → helper.o
  2. utils.cpp + helper.o → utils.o
  3. main.cpp + utils.o → main.o
  4. main.o + utils.o + helper.o → app
```

### 增量构建的关键

```
判断一个目标是否需要重新构建：

  如果所有依赖项的时间戳都比目标新：
    → 不需要重建（目标是最新的）
  如果有任何依赖项比目标旧或不存在：
    → 需要重建

Make 的问题：
  - 基于时间戳，不可靠（修改后改回时间戳仍变）
  - 不处理环境变化（如编译器版本升级）
  - 不处理命令行参数变化

现代构建系统的改进：
  - 基于内容哈希（Content-Addressable）
  - 记录完整的输入指纹（文件内容 + 命令 + 环境变量）
```

## 构建系统对比

### Make

```makefile
app: main.o utils.o
    g++ -o app main.o utils.o

main.o: main.cpp utils.h
    g++ -c main.cpp

utils.o: utils.cpp utils.h helper.h
    g++ -c utils.cpp
```

```
特点：
  - 基于规则（Rule）
  - 目标：依赖列表 + 命令
  - 时间戳驱动

问题：
  - 递归 Make 破坏依赖图（子目录独立 Make）
  - 隐式依赖容易遗漏（如编译器内置头文件）
  - 并行构建依赖声明不完整会出错
  - 不支持分布式缓存
```

### Ninja

```ninja
# build.ninja（由 CMake 或 GYP 生成）

rule cxx
  command = g++ -c $in -o $out
  deps = gcc

rule link
  command = g++ $in -o $out

build helper.o: cxx helper.cpp
build utils.o: cxx utils.cpp
build main.o: cxx main.cpp
build app: link main.o utils.o helper.o
```

```
特点：
  - 设计目标：速度（比 Make 快）
  - 极简语法，不表达高级逻辑
  - 由高级工具（CMake、GN）生成 .ninja 文件
  - 内置 deps log 追踪头文件依赖

优势：
  - 解析快（相比 Makefile 的复杂 shell 脚本）
  - 并行调度高效
  - 适用于大规模 C++ 项目（Chromium、LLVM）
```

### Bazel

```python
# BUILD
cc_binary(
    name = "app",
    srcs = ["main.cpp"],
    deps = ["//lib:utils"],
)

cc_library(
    name = "utils",
    srcs = ["utils.cpp"],
    hdrs = ["utils.h", "helper.h"],
)
```

```
特点：
  - Starlark 语言定义构建规则
  - Hermetic build：声明所有输入，可重现
  - 沙箱执行：限制规则只能访问声明的输入
  - 远程缓存和远程执行
  - 增量构建基于内容哈希

概念：
  Workspace：工作区，包含所有源码和 BUILD 文件
  Package：包含 BUILD 文件的目录
  Target：构建目标（binary、library、test）
  Action：构建动作（编译、链接）
  Artifact：构建产物
```

## 构建缓存

### 本地缓存

```
Bazel 缓存结构：

  ~/.cache/bazel/
    ├── action_cache/       # Action 输入 → 输出映射
    ├── cas/                # Content-Addressable Storage
    │   ├── 00/12/34...     # 文件内容哈希 → 文件
    │   └── ...
    └── external/           # 外部依赖

缓存命中条件：
  - 输入文件内容哈希不变
  - 编译命令不变
  - 环境变量不变
  - 工具链不变

增量构建 vs 缓存：
  - 增量：只重建变化的部分
  - 缓存：复用之前构建的结果（即使跨 clean）
```

### 远程缓存（Remote Cache）

```
架构：

  Developer A ──► Bazel Server ──► Remote Cache (Redis/S3/HTTP)
                                      │
  Developer B ──► Bazel Server ───────┘

工作流程：
  1. Bazel 计算 Action 的输入哈希
  2. 查询 Remote Cache：是否有这个 Action 的结果？
  3. 命中：下载产物，本地零编译
  4. 未命中：本地执行，上传结果到缓存

协议：
  - Remote Execution API（Bazel 定义，gRPC）
  - 支持：BuildBarn、bazel-remote、Google RBE

收益：
  - 团队共享编译结果
  - CI 构建结果复用
  - 新机器/新分支无需重新编译
```

### 缓存 key 设计

```
好的缓存 key = 完整且稳定的输入指纹

应包含：
  - 输入文件内容哈希（不是路径）
  - 编译器版本和路径
  - 编译命令行参数
  - 环境变量（如 PATH、CC）
  - 依赖库的内容哈希

应避免：
  - 绝对路径（不同机器路径不同）
  - 时间戳
  - 非确定性输出（如 __DATE__、随机数）

Bazel 的做法：
  - 每个 Action 有完整的输入声明
  - 沙箱确保没有未声明的输入
  - key = hash(所有输入)
```

## 分布式构建

### 远程执行（Remote Execution）

```
架构：

  Bazel Client
      │
      ├──► Remote Scheduler ──► Worker Pool
      │                            │
      └──► Remote Cache ◄──────────┘

工作流程：
  1. Bazel 分析构建图，生成 Actions
  2. 查询 Remote Cache（本地 + 远程）
  3. 未命中的 Actions 提交到 Remote Scheduler
  4. Scheduler 分发给 Worker Pool 执行
  5. Worker 执行后，结果存入 Remote Cache
  6. Bazel 下载结果

Worker 要求：
  - 相同的工具链版本
  - 相同的操作系统和环境
  - Hermetic：只使用声明的输入
```

### 任务调度

```
调度策略：

1. 本地优先：
   - 小任务本地执行（上传下载开销 > 执行时间）
   - 大任务远程执行

2. 预估执行时间：
   - 基于历史数据预估 Action 耗时
   - 优先调度长任务（减少总 makespan）

3. 数据局部性：
   - 把任务调度到已有输入文件的 Worker
   - 减少数据传输

4. 动态负载均衡：
   - Worker 向 Scheduler 上报负载
   - 避免热点 Worker
```

## 核心追问

1. **Bazel 的 hermetic build 为什么需要沙箱？** 声明所有输入容易遗漏（如编译器隐式包含的头文件）；沙箱限制规则只能访问声明的文件，未声明的访问会报错，强制开发者补全依赖
2. **Ninja 为什么不直接被人手写？** Ninja 语法太底层，不适合表达复杂逻辑（如条件编译、平台检测）；高级构建系统（CMake/GN）先生成 Ninja，再由 Ninja 快速执行
3. **远程缓存什么情况下会失效？** 工具链版本升级、编译器补丁、环境变量变化、非确定性输入（__TIME__）、构建规则修改；Bazel 的 Action 指纹包含这些因素，变化时自动失效
4. **为什么 Bazel 比 Make 更适合大规模项目？** Bazel 有完整的依赖图分析、hermetic 保证、远程缓存/执行、正确的增量构建；Make 的时间戳驱动和隐式依赖在大规模下不可靠
5. **分布式构建中网络带宽是瓶颈怎么办？** 增量同步（只传变化的输入）、压缩、数据局部性调度、Worker 缓存热数据；极端情况下可以在 Worker 上预先同步工具链和外部依赖

## 状态

| 资产 | 状态 |
|---|---|
| compiler pipeline notes | done |
| build graph and cache | done |
| incremental build design | todo |
| monorepo build architecture | todo |
