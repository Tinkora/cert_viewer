# Tinkora Cert Viewer

[English](README.md)

[![在 Ko-fi 上支持 Tinkora](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/tinkora)

Tinkora Cert Viewer 是一个仅用于检查、浏览器优先的 X.509 证书查看器，证书内容始终留在你的设备上。

[打开在线查看器](https://tinkora.github.io/cert_viewer/)

## 能力状态

| Capability | Current surface |
| --- | --- |
| Human-usable | Browser UI |
| Machine-readable | Versioned JSON result |
| Agent schema draft | Published JSON Schema |
| Not Agent-callable | No transport or integration |

此 Schema 可供本地消费者和未来的集成研究使用。0.1.0 版本不提供 agent 工具、端点、MCP server 或调用协议。

## 支持的输入

- 粘贴一个 PEM 编码的 X.509 证书或 PEM bundle。
- 选择或拖放 PEM 或 DER 证书文件，包括 `.pem`、`.crt`、`.cer` 和 `.der` 文件。
- 每次操作最多检查 1 MiB 输入和 32 个证书。
- 将包含多个证书的 PEM bundle 视为有序集合。Cert Viewer 不建立或验证证书链。

本项目有意不支持私钥和 PKCS#12 归档。请勿粘贴私钥或其他秘密信息。

## 检查语义

结果会报告证书字段、指纹、扩展，以及根据浏览器时钟计算的日期状态。三个日期状态分别为 `not_yet_valid`、`within_stated_dates` 和 `expired`；它们不建立证书信任，也不判断证书是否适用于某个 hostname。

`is_self_issued` 是对 x509-parser 中 subject 与 issuer 结构表示的直接比较。使用不同编码的等价名称可能比较为不相等；即使结果为 true，也不能证明证书签名可由其自身公钥验证。

界面不会显示笼统的 valid、trusted 或 verified 标记。每个证书始终独立检查，包括同一个 PEM bundle 中的证书。

## 隐私

解析和渲染通过 WebAssembly 在浏览器本地完成。应用没有后端、分析、遥测或上传端点，也不会持久化证书内容。托管静态构建时，浏览器仍需从托管方获取应用文件。

## 快速开始

使用[在线查看器](https://tinkora.github.io/cert_viewer/)，粘贴或拖放证书，然后选择 **检查**。内置样例是公开测试数据，可安全用于了解界面。

在本地运行生产构建：

```bash
npm ci --ignore-scripts
npm run build:web
python3 -m http.server 8080 --directory dist
```

打开 `http://localhost:8080`。构建需要 Rust 1.95.0、`wasm32-unknown-unknown` target 和 wasm-pack 0.15.0。部署、CSP、缓存与回滚说明见[自托管](docs/SELF_HOSTING.md)。

## 开发与测试

```bash
npm ci --ignore-scripts
cargo fmt --all -- --check
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo check -p cert_viewer_web --target wasm32-unknown-unknown
npm run test:web
npm run test:schema
npm run build:web
npm run test:browser
ruby scripts/check_docs.rb
npx --no-install markdownlint-cli2 '**/*.md'
```

浏览器测试会启动本地静态服务器，并检查用户工作流、无障碍访问和网络隐私。

## Schema 兼容性

成功的检查结果可使用 [version 1 JSON Schema](docs/schema/README.md) 表示。消费者必须要求 `schema_version: 1`、拒绝不支持的版本，并拒绝未知属性。删除或重命名字段、改变类型或语义时必须发布新的 Schema 版本。该 Schema 不定义错误结果、远程 API 或可调用的 agent 集成。

## 浏览器支持

自动化发布检查覆盖当前 Playwright Chromium。预期支持具备 WebAssembly 和 JavaScript module 能力的当前 Chrome、Edge、Firefox 和 Safari 版本。剪贴板写入需要 secure context 或 localhost，并可能被浏览器权限拒绝；复制不可用时仍可检查证书。

## 已知限制

- 不执行签名、认证路径、吊销、CT、trust store 或 hostname verification。
- 不推断 PEM bundle 的顺序是否正确，也不声称它构成 verified chain。
- 不解析私钥、CSR、PKCS#7 或 PKCS#12。
- 日期状态取决于用户的浏览器时钟。
- Schema 仅描述成功的检查结果。
- 0.1.0 不发布 agent-callable transport 或 integration。

## 安全、支持与贡献

请通过 [GitHub Private Vulnerability Reporting](https://github.com/tinkora/cert_viewer/security/advisories/new) 报告漏洞，绝不要提交公开 issue。参与前请阅读[安全政策](SECURITY.zh-CN.md)、[支持指南](SUPPORT.zh-CN.md)、[贡献指南](CONTRIBUTING.zh-CN.md)和[行为准则](CODE_OF_CONDUCT.zh-CN.md)。

## 发布与验证

发布资产、校验和、SBOM 和 attestation 通过 GitHub Releases 提供。维护者遵循[发布流程](docs/RELEASING.md)；消费者应比对校验和，并针对预期仓库和不可变 tag 验证 attestation。

## 引用

请使用 [`CITATION.cff`](CITATION.cff) 元数据或 GitHub 的 **Cite this repository** 功能。需要可复现性时，请引用带版本的 release。

## 许可证

Cert Viewer 使用 [MIT License](LICENSE)。捆绑的第三方材料记录在 [Third-Party Notices](THIRD_PARTY_NOTICES.md) 中。
