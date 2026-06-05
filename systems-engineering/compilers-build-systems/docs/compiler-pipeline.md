# Compiler Pipeline

## 目标

理解从源码到机器码的完整编译链路：词法分析、语法分析、语义分析、中间表示、优化和目标代码生成，以及不同编译器（GCC、LLVM、Go）的架构差异。

## 场景

- 编译错误发生在哪个阶段？Syntax Error vs Link Error？
- 为什么 Rust 编译慢但运行快？
- LLVM 的 IR 为什么能成为这么多语言的共同后端？
- 编译器的 `-O2` 和 `-O3` 到底做了什么？
- JIT 和 AOT 编译的本质区别？

## 编译流程概览

```
源码 ──► 前端 ──► 中间表示 ──► 优化器 ──► 后端 ──► 机器码
         │           │           │          │
      Lexer      AST/IR      Passes     CodeGen
      Parser     Semantic    Inline     Instruction
      TypeCheck  Analysis    LoopUnroll Selection
                             ...        RegisterAlloc
```

## 前端（Frontend）

### 词法分析（Lexical Analysis）

```
输入：源代码字符串
输出：Token 序列

int main() {
    return 42;
}

↓ Lexer

INT, IDENT("main"), LPAREN, RPAREN, LBRACE,
RETURN, NUMBER(42), SEMICOLON, RBRACE

工具：
  - lex / flex（生成 scanner）
  - 手写（Rustc、Go）
```

### 语法分析（Parsing）

```
输入：Token 序列
输出：抽象语法树（AST）

        FunctionDecl
           │
    ┌──────┼──────┐
    ▼      ▼      ▼
  Type   Name   Body
   │       │      │
  int   "main"  CompoundStmt
                  │
          ┌───────┴───────┐
          ▼               ▼
      ReturnStmt      (其他语句)
          │
          ▼
      IntegerLiteral
          │
         42

算法：
  - 递归下降（Recursive Descent）：手写，灵活（Go、Rustc）
  - LR(1) / LALR：自动工具生成（Yacc/Bison，用于 C）

错误恢复：
  - Panic mode：跳过 Token 直到同步点
  - 错误产生式：在语法中定义常见错误模式
```

### 语义分析（Semantic Analysis）

```
在 AST 上进行的检查：

1. 类型检查（Type Checking）
   int x = "hello";  → 类型不匹配错误

2. 作用域解析（Scope Resolution）
   变量在哪个作用域定义？
   是否重复定义？

3. 符号表构建（Symbol Table）
   记录所有标识符的信息：
     name → { type, scope, memory_size, location }

4. 控制流检查
   - return 是否匹配函数类型
   - 是否所有分支都有返回值
   - break/continue 是否在循环内
```

## 中间表示（IR）

### 为什么需要 IR？

```
前端：N 种语言 × 后端：M 种目标架构

直接编译：N × M 个编译器
使用 IR：N 个前端 + M 个后端

优势：
  - 语言无关的优化
  - 目标架构无关的分析
  - 复用优化器和后端
```

### LLVM IR

```
; LLVM IR 示例：计算 a + b * c
define i32 @calc(i32 %a, i32 %b, i32 %c) {
entry:
  %mul = mul i32 %b, %c
  %add = add i32 %a, %mul
  ret i32 %add
}

特点：
  - SSA（Static Single Assignment）：每个变量只赋值一次
  - 三地址码：x = y op z
  - 类型系统完整
  - 无限虚拟寄存器

SSA 好处：
  - 简化数据流分析
  - 清晰的 def-use 链
  - 便于优化（如常量传播、死代码消除）
```

### 其他 IR 形式

| IR | 特点 | 代表 |
|---|---|---|
| AST | 高层，保留语法结构 | 所有编译器 |
| Three-Address Code | 三地址，接近机器码 | GCC GIMPLE |
| SSA | 单赋值，优化友好 | LLVM IR、GCC GIMPLE |
| Bytecode | 虚拟机执行 | JVM Bytecode、.NET IL |
| Machine IR | 带物理寄存器 | LLVM MachineInstr |

## 优化器（Optimizer）

### 优化层级

```
-O0：不优化，调试友好
-O1：基本优化，平衡编译时间和运行性能
-O2：激进优化（推荐生产使用）
-O3：极度激进（可能增大代码体积）
-Os：优化代码大小
-Oz：极度优化大小（LLVM）
```

### 常见优化 Pass

```
1. 常量折叠（Constant Folding）
   x = 2 + 3 → x = 5

2. 常量传播（Constant Propagation）
   a = 5; b = a + 1 → b = 6

3. 死代码消除（Dead Code Elimination）
   x = 10; x = 20; return x;
   → 删除 x = 10

4. 公共子表达式消除（CSE）
   a = b + c; d = b + c;
   → d = a

5. 函数内联（Function Inlining）
   把 small function 的体直接嵌入调用处
   → 消除调用开销，暴露更多优化机会

6. 循环优化：
   - 循环不变量外提（LICM）
   - 强度削减（i*2 → i<<1）
   - 循环展开（Loop Unrolling）
   - 向量化（SIMD）

7. 逃逸分析（Escape Analysis）
   对象是否逃出当前作用域
   → 决定能否栈分配（代替堆分配）

8. 标量替换（Scalar Replacement）
   把小的 struct 拆成独立字段
   → 便于寄存器分配
```

### LLVM Pass 架构

```
LLVM 使用 Pass 管理器组织优化：

ModulePass：  整个模块
FunctionPass：每个函数
LoopPass：    每个循环
BasicBlockPass：每个基本块

Pass 顺序：
  1. 分析 Pass（Analysis）：计算信息（如 dominator tree）
  2. 转换 Pass（Transform）：修改 IR
  3. 分析结果缓存，供后续 Pass 复用

例子：
  -O2 包含约 60 个 Pass
  每个 Pass 遍历一次 IR
  多次遍历直到没有变化
```

## 后端（Backend）

### 指令选择（Instruction Selection）

```
将 IR 映射到目标架构指令：

LLVM IR:  %add = add i32 %a, %b

x86:  addl %ebx, %eax
ARM:  ADD r0, r0, r1
RISC-V: add a0, a0, a1

方法：
  - 模式匹配（Pattern Matching）
  - DAG（Directed Acyclic Graph）覆盖
  - 基于 TableGen 的自动生成
```

### 寄存器分配（Register Allocation）

```
问题：IR 有无限虚拟寄存器，但 CPU 只有有限物理寄存器

算法：
  1. 图着色（Graph Coloring）：
     - 冲突图：同时活跃的变量连边
     - 着色 = 分配寄存器
     - 无法着色 → 溢出到栈（Spill）

  2. 线性扫描（Linear Scan）：
     - 按程序顺序扫描
     - 更快但质量略差
     - JIT 编译器常用

溢出代价：
  - 从寄存器到内存的 load/store
  - 影响性能，应尽量避免
```

### 指令调度（Instruction Scheduling）

```
目标：最大化指令级并行（ILP），减少流水线停顿

技术：
  - 重排指令顺序
  - 填充延迟槽（Delay Slot）
  - 考虑 CPU 微架构（执行单元、流水线深度）
```

## 链接（Linking）

### 静态链接 vs 动态链接

```
静态链接：
  编译时把所有依赖库的代码复制到可执行文件
  
  优点：无运行时依赖，部署简单
  缺点：体积大，多个程序重复存储相同库

动态链接：
  运行时加载共享库（.so / .dll / .dylib）
  
  优点：体积小，库更新不用重新编译程序
  缺点：依赖地狱（DLL Hell），运行时找不到库
```

### 符号解析

```
符号类型：
  强符号：函数和已初始化的全局变量
  弱符号：未初始化的全局变量，可用 __attribute__((weak)) 标记

链接规则：
  - 不允许多个强符号同名
  - 一个强符号 + 多个弱符号 → 用强符号
  - 多个弱符号 → 任选一个

常见错误：
  - Multiple Definition：多个文件定义同名全局变量
  - Undefined Reference：声明了函数但没有定义或没链接库
```

## 各语言编译器对比

| 编译器 | 前端 | IR | 优化 | 后端 | 特点 |
|---|---|---|---|---|---|
| GCC | C/C++/... | GIMPLE (SSA) | 成熟 | 自研 | 支持最广，编译慢 |
| Clang/LLVM | C/C++/Rust/Swift | LLVM IR | 模块化 | LLVM | 优化好，工具链丰富 |
| Go Compiler | Go | SSA | 中等 | 自研 | 编译快，逃逸分析 |
| Rustc | Rust | LLVM IR | 激进 | LLVM | 零成本抽象，编译慢 |
| V8 (JIT) | JS | TurboFan IR | 推测优化 | x64/ARM | 运行时编译，OSR |
| Java (HotSpot) | Java Bytecode | C1/C2 IR | 分层编译 | x64/ARM | C1快C2优，GC联动 |

## 核心追问

1. **编译错误中 syntax error 和 semantic error 的区别？** syntax error 是 Parser 阶段发现的不符合语法规则（如缺少分号）；semantic error 是语法正确但语义不合理（如类型不匹配、未定义变量）
2. **为什么 Rust 编译比 C++ 慢？** Rust 有 borrow checker（复杂的所有权分析）、宏展开在编译期、LLVM IR 生成量大且优化 Pass 多；C++ 模板也有类似问题
3. **LLVM 为什么能成为通用后端？** LLVM IR 设计良好（SSA、类型完整、与语言和目标无关），工具链成熟（opt、llc、lli），Pass 架构可扩展，许可协议友好
4. **内联一定提升性能吗？** 不一定。内联增大代码体积 → 指令缓存不友好；小函数内联收益大，大函数可能降低性能；编译器有 heuristics 控制
5. **JIT 为什么比 AOT 启动快但峰值性能低？** JIT 运行时编译，启动无编译等待，但编译时间也算在运行时；AOT 预先优化充分，JIT 受限于运行时资源，优化时间有限

## 状态

| 资产 | 状态 |
|---|---|
| compiler pipeline notes | done |
| build graph and cache | todo |
| incremental build design | todo |
| monorepo build architecture | todo |
