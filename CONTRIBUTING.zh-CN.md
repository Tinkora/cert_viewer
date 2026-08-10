# 为 Tinkora Cert Viewer 贡献

[English](CONTRIBUTING.md)

感谢你帮助改进这个仅用于检查、仅在本地运行的证书查看器。所有贡献都必须遵守 [`AGENTS.md`](AGENTS.md) 中的产品与隐私边界。

本指南将 [Tinkora 组织级社区政策](https://github.com/Tinkora/.github)落实到 Cert Viewer 的开发和 review 流程。

## 先创建 Issue

开始较大工作前，请使用对应的 Issue Form。可复现 bug 需要提供步骤和环境信息；feature request 需要提供真实用户工作流的证据、备选方案，以及它为何符合 inspection-only 定位。尚不能采取行动的使用问题请发到 [GitHub Discussions](https://github.com/tinkora/cert_viewer/discussions)。

绝不要在公开 issue 中发布敏感证书、私钥、账号数据或漏洞细节。安全报告请使用 [Private Vulnerability Reporting](https://github.com/tinkora/cert_viewer/security/advisories/new)。

## 开发流程

1. Fork 仓库并 clone 你的 fork。
2. 基于最新 `main` 创建聚焦的分支，例如 `feat/clear-subject-copy` 或 `fix/der-file-detection`。
3. 修改行为前先添加面向结果的失败测试，确认测试按预期失败，再实现最小而完整的修改并让测试通过。
4. 每个 commit 只包含一个连贯里程碑，并使用英文 [Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/) 消息，例如 `fix: preserve certificate order`。
5. 所有新增或修改的代码注释都使用英文，只解释不明显的约束或决策。
6. 将分支 push 到你的 fork，并创建关联 issue 的 pull request。

维护者使用 squash merge，使每个合并后的 pull request 在 `main` 上成为一个可审查的 Conventional Commit。

## 本地环境

安装 Rust 1.95.0 和 `wasm32-unknown-unknown` target、wasm-pack 0.15.0、Node.js 24 与 Ruby。安装 JavaScript 依赖时禁用 lifecycle script：

```bash
npm ci --ignore-scripts
```

## 必需检查

运行受修改影响的检查，并在 pull request 中报告准确命令和结果。请求最终 review 前，完整本地基线为：

```bash
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
git diff --check
```

不要为了让检查通过而削弱断言、跳过测试或抑制 warning。相关命令无法在本机运行时，应说明具体平台限制。

## 前端修改

创建、修改、审查或调试任何 HTML 页面或面向用户的前端之前，必须使用 `ui-ux-pro-max` skill。编辑前先运行其要求的 `--design-system` 搜索，再运行相关 stack 与 UX 搜索。使用真实浏览器在 375、768、1024 和 1440 像素宽度验证渲染结果，包括 console、键盘、无障碍、网络隐私和 overflow 检查。在 pull request 中附上有用的截图或无障碍证据。

## Review 要求

保持 pull request 聚焦且易于审查。说明行为与隐私影响，展示测试证据；面向用户的行为变化应同时更新英语和简体中文文档。使用代码或明确的技术推理回应 review；只有问题真正解决后才关闭 conversation。

公共 JSON 字段的修改需要 Schema 测试、兼容性文档和版本决策。除非存在经过独立批准的证据与实现，否则不得声称提供 agent transport、trust decision、verified chain 或 hostname verification。

## Changelog 与发布

影响用户、安全边界、兼容性、安装或发布资产时，应添加 changelog 条目。拼写修复和内部重构通常不需要，但应在 pull request 中记录该判断。版本选择、release commit、不可变 tag 和 GitHub Release 由维护者负责。

## 社区

参与行为受[行为准则](CODE_OF_CONDUCT.zh-CN.md)约束；支持路由见[支持指南](SUPPORT.zh-CN.md)，漏洞处理见[安全政策](SECURITY.zh-CN.md)。
