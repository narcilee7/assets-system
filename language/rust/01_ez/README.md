# 认识和安装Rust工具链

1. rustup
2. rustc -v
3. cargo

## hello world!

```shell
cargo run
```

`cargo run` == `cargo build && ./target/debug/word_hello`

## Cargo.toml和Cargo.lock

`Cargo.toml` 和 `Cargo.lock` 是 cargo 的核心文件，它的所有活动均基于此二者。

Cargo.toml 是 cargo 特有的项目数据描述文件。它存储了项目的所有元配置信息，如果 Rust 开发者希望 Rust 项目能够按照期望的方式进行构建、测试和运行，那么，必须按照合理的方式构建 Cargo.toml。

Cargo.lock 文件是 cargo 工具根据同一项目的 toml 文件生成的项目依赖详细清单，因此我们一般不用修改它，只需要对着 Cargo.toml 文件撸就行了
