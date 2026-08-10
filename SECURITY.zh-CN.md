# 安全政策

[English](SECURITY.md)

本仓库依据 [Tinkora 组织级社区政策](https://github.com/Tinkora/.github)，并在下文定义 Cert Viewer 特有的安全边界和响应流程。

## 支持的版本

| Version | Security support |
| --- | --- |
| 0.1.x | Supported |
| Earlier or unreleased versions | Not supported |

安全修复发布在当前 `0.1.x` 版本线。除非 release notice 明确说明，否则已被取代的 release 不会获得 backport。

## 报告漏洞

请使用 [GitHub Private Vulnerability Reporting](https://github.com/tinkora/cert_viewer/security/advisories/new)。不要为疑似漏洞创建公开 issue、Discussion 或 pull request。请尽可能提供受影响版本、影响、复现细节和不敏感的最小样例。绝不要包含私钥、生产证书、账号数据或无关个人信息。

我们预期在 72 小时内确认收到报告、7 天内提供初步 triage 进展，并在报告仍处于活动状态时至少每 14 天提供一次修复或协调进展。这些是响应目标，并非修复期限保证。

维护者将验证报告，在适当时商定披露时间，准备修复和 release，并在报告者要求且条件允许时给予署名。

## 安全边界

Cert Viewer 在浏览器本地检查不受信任的 PEM 和 DER 证书数据。证书文本始终以文本渲染；输入限制为 1 MiB 和 32 个证书；浏览器隐私测试会拒绝检查过程中出现的非预期网络请求。

证书可能包含可识别个人身份的名称、内部 hostname、电子邮件地址和组织元数据。即使公开 TLS 证书通常可从其他位置观察到，也应将它们视为潜在敏感信息。应用不需要私钥，请绝不要提供私钥。

## 产品不做出的声明

Cert Viewer 不执行签名、认证路径、吊销、CT、trust store 或 hostname verification。它不判断证书是否应被信任、是否获准用于某项服务，也不判断 PEM bundle 中的证书是否构成 verified chain。`is_self_issued` 只比较 subject 与 issuer 名称。

有关误导性检查输出、不安全渲染、parser 资源消耗、依赖被破坏、非预期网络行为或发布资产完整性的报告属于范围内。一般性的证书政策分歧，以及已记录为不存在的能力，除非造成具体安全影响，否则不属于漏洞。

## 披露

公开披露前，请为协调修复预留时间。Release note 会描述用户影响和升级指引，同时避免暴露报告者的敏感信息。GitHub Security Advisories 是正式协调记录。
