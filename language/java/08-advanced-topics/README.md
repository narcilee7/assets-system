# Java 高级主题

这一层探索 Java 的边界能力：反射、动态代理、Unsafe、SPI、GraalVM 原生镜像。

---

## 目录

| 文件 | 主题 |
|------|------|
| `reflection-and-proxy.md` | 反射 API、动态代理（JDK/CGLIB）、性能代价 |
| `unsafe-and-offheap.md` | Unsafe 操作、堆外内存、内存屏障 |
| `spi-and-service-loader.md` | SPI 机制、ServiceLoader、插件化架构 |
| `graalvm-and-native-image.md` | GraalVM、AOT 编译、原生镜像限制 |
| `jvm-tuning.md` | GC 调优、内存泄漏排查、Arthas 诊断 |

---

## 核心问题

1. 反射的性能瓶颈在哪里？如何优化（如 MethodHandle、LambdaMetafactory）？
2. Unsafe 的合法使用场景与风险？
3. SPI 与 IoC 的区别？Dubbo 的 SPI 扩展点设计？
4. GraalVM 原生镜像的反射配置和动态代理限制？
5. 如何用 Arthas 诊断线上 CPU 飙高问题？

---

## 关联训练场

- `../mini-runtime/` — 动态代理实验、反射工具类
