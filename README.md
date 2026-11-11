# 远齐 SSO 单点登录协议测试工具（ssotest）

[![GitHub](https://img.shields.io/badge/GitHub-uieip%2Fyuanqi--open-181717?logo=github)](https://github.com/uieip/yuanqi-open)
[![Gitee](https://img.shields.io/badge/Gitee-uieip%2Fyuanqi--open-C71D23?logo=gitee)](https://gitee.com/uieip/yuanqi-open)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D16-339933?logo=node.js)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)

简体中文 | [English](./README.en.md)

面向 **远齐统一身份认证中心（UIEIP / 远齐 SSO）** 的协议联调与验收工具，用于验证业务系统接入单点登录时的授权跳转、凭证交换、用户信息获取与单点登出链路是否符合预期。

> 本工具仅用于**开发调试与测试环境**，请勿直接作为生产业务系统部署。

- GitHub：<https://github.com/uieip/yuanqi-open>
- Gitee：<https://gitee.com/uieip/yuanqi-open>

## 目录

- [功能特性](#功能特性)
- [支持的协议](#支持的协议)
- [前置条件：安装 UIEIP](#前置条件安装-uieip)
- [工作原理](#工作原理)
- [目录结构](#目录结构)
- [快速开始](#快速开始)
- [配置说明](#配置说明)
- [在认证中心登记应用（许可管理）](#在认证中心登记应用许可管理)
- [各协议测试参数](#各协议测试参数)
- [认证中心接口文档](#认证中心接口文档)
  - [OAuth 2.0](#oauth-20)
  - [OpenID Connect](#openid-connect)
  - [CAS 2.0](#cas-20)
  - [SAML 2.0](#saml-20)
  - [远齐 SSO（旧版）](#远齐-sso旧版)
  - [LDAP](#ldap)
- [测试工具后端 API](#测试工具后端-api)
- [测试流程](#测试流程)
- [常见问题](#常见问题)
- [安全说明](#安全说明)
- [技术栈](#技术栈)
- [参与贡献](#参与贡献)
- [许可证](#许可证)

## 功能特性

- 覆盖 OAuth 2.0、OpenID Connect、CAS 2.0、SAML 2.0、远齐 SSO（旧版）五种主流接入方式。
- **凭证交换全部在服务端完成**：`access_token`、`code`、`ticket`、`Token`、`SAMLResponse` 不出现在浏览器可见的请求里，贴近真实业务接入方式。
- 每个协议页面都提供参数表单、登录状态面板、错误提示与用户信息（含头像）展示。
- 支持同一页面完成 **登录 → 回调 → 展示 → 退出登录** 的闭环验证。
- 纯静态前端（HTML + 原生 JS + Bootstrap 5），无构建步骤，`npm install` 后即可运行。
- 会话使用 `express-session` 保存协议上下文，重启进程即失效，便于反复回归测试。
- 内置各协议的接口说明与错误码附录，可直接对照排查。

## 支持的协议

| 协议 | 说明 | 测试页面 | 后端接口前缀 |
| --- | --- | --- | --- |
| **OAuth 2.0** | 标准授权码模式，支持静默 / 手动授权 | [`public/oauth2.html`](public/oauth2.html) | `/api/oauth2/*` |
| **OpenID Connect** | 基于 OAuth 2.0 的身份认证，含 userinfo | [`public/oidc.html`](public/oidc.html) | `/api/oidc/*` |
| **CAS 2.0** | 中央认证服务，ticket 校验 | [`public/cas.html`](public/cas.html) | `/api/cas/*` |
| **SAML 2.0** | 断言标记语言，HTTP-Redirect 请求 / HTTP-POST 响应 | [`public/saml.html`](public/saml.html) | `/api/saml/*`、`/saml/acs` |
| **远齐 SSO（旧版）** | 远齐旧版 `BackURL` + `Token` 模式 | [`public/yuanqi.html`](public/yuanqi.html) | `/api/yuanqi/*` |
| **LDAP** | 内置 LDAP Service（Bind/Search），供 VPN 等系统直连 | —（无测试页） | 使用 LDAP 客户端直连 |

首页 [`public/index.html`](public/index.html) 是协议选择导航页。

## 前置条件：安装 UIEIP

本仓库只是**协议测试工具**，本身不提供认证能力。使用前必须准备一个可访问的 **UIEIP（远齐统一身份认证平台）** 实例，作为 SSO 认证中心。

- GitHub 仓库：<https://github.com/uieip/yuanqi-open>
- Gitee 仓库：<https://gitee.com/uieip/yuanqi-open>

下载方式与安装步骤请以仓库首页 README 和 **Releases** 页面中的说明为准：

1. 打开上述任一仓库（GitHub 与 Gitee 内容同步，国内访问建议 Gitee）。
2. 进入 **Releases** 下载对应平台的发行包（或按 README 说明从源码构建）。
3. 按 README 的部署章节完成初始化，启动认证中心服务。
4. 记录认证中心的访问地址（示例：`http://localhost:8011`），后续填入本工具的 `SSO_BASE`。

> 本工具默认按 `http://localhost:8011` 连接认证中心；若你的部署地址或端口不同，请修改 `server.js` 中的 `SSO_BASE`（见[配置说明](#配置说明)）。

## 工作原理

```
┌──────────────────────────────┐   HTTP    ┌─────────────────────────────┐
│   测试工具（ssotest）           │ ────────► │   UIEIP / 远齐 SSO 认证中心     │
│   Node.js + Express           │           │   授权 / Token / 用户信息接口   │
│   http://localhost:8000       │ ◄──────── │   http://localhost:8011     │
│   授权跳转 / 凭证交换 / 结果展示   │   跳转     │                             │
└──────────────────────────────┘           └─────────────────────────────┘
```

1. 在测试页面填写应用参数，点击 **SSO 登录**。
2. 浏览器请求测试工具后端（如 `/api/oauth2/start`），后端向认证中心申请凭证并返回授权跳转 URL。
3. 浏览器跳转到认证中心完成身份认证，认证中心携带 `code` / `ticket` / `Token` / `SAMLResponse` 回调测试页面。
4. 前端把凭证交给后端，由后端完成凭证交换与用户信息查询。
5. 前端展示 UserID、用户属性、头像以及原始协议报文（SAML）。

## 目录结构

```
yuanqi-open/                 # 本仓库根目录
├── public/                  # 前端测试页面（静态资源）
│   ├── index.html           # 首页：协议选择导航
│   ├── oauth2.html          # OAuth 2.0 测试页
│   ├── oidc.html            # OpenID Connect 测试页
│   ├── cas.html             # CAS 2.0 测试页
│   ├── saml.html            # SAML 2.0 测试页（含 AuthnRequest / Response 报文查看）
│   ├── yuanqi.html          # 远齐 SSO（旧版）测试页
│   └── lib/bootstrap-5.3.3/ # 本地 Bootstrap 静态资源
├── server.js                # 测试工具后端（Express，核心逻辑）
├── package.json             # 依赖与启动脚本
├── package-lock.json        # 依赖锁定
├── README.md                # 中文文档（本文件）
├── README.en.md             # English documentation
├── LICENSE                  # Apache License 2.0
└── .gitignore               # 忽略 node_modules、dist 等
```

## 快速开始

### 环境要求

- Node.js >= 16（推荐 18 LTS 及以上）
- 已安装并可访问的 UIEIP 认证中心（见[前置条件](#前置条件安装-uieip)）

### 1. 安装依赖

```bash
npm install
```

### 2. 配置认证中心地址

编辑 [`server.js`](server.js#L7-L9) 顶部的两个常量：

```js
const PORT = 8000;                          // 测试工具监听端口
const SSO_BASE = 'http://localhost:8011';   // UIEIP 认证中心地址
```

- `SSO_BASE` 必须是**浏览器与服务端都能访问**的认证中心地址；若认证中心在远端环境，请改成对应域名（如 `http://user.example.com`）。
- 若同时存在线上与本地认证中心，请在联调前确认 `SSO_BASE` 指向本地，否则测试请求会打到线上环境。

### 3. 启动

```bash
npm start
```

控制台输出示例：

```
SSO 测试服务已启动: http://localhost:8000
SSO 服务地址: http://localhost:8011
```

### 4. 访问并验证

1. 打开 <http://localhost:8000>。
2. 选择协议并填写参数（见[各协议测试参数](#各协议测试参数)）。
3. 点击 **SSO 登录**，完成认证后应回调到测试页面并展示用户信息。

## 配置说明

| 配置项 | 位置 | 说明 | 默认值 |
| --- | --- | --- | --- |
| `PORT` | [`server.js`](server.js#L7) | 测试工具监听端口 | `8000` |
| `SSO_BASE` | [`server.js`](server.js#L8) | UIEIP 认证中心基础地址，用于签发跳转 URL 与服务端 API 调用 | `http://localhost:8011` |
| `session.secret` | [`server.js`](server.js#L14) | 会话签名密钥，部署到共享测试环境前请替换 | `sso-test-secret-key-yuanqi` |
| `session.cookie.maxAge` | [`server.js`](server.js#L17) | 会话有效期 | 30 分钟 |

> 会话默认存放在进程内存中，重启 `server.js` 会使进行中的测试会话失效（表现为“session 已失效，请重新登录”），重新点击登录即可。

## 在认证中心登记应用（许可管理）

认证中心只允许已登记的应用发起认证请求，未登记会返回 `The application does not exist.`。请先在管理后台完成登记：

**组织权限管理 → 许可管理**（数据库表 `app_client`）

| 后台字段 | 说明 | 测试环境建议 |
| --- | --- | --- |
| 名称 | 应用标识名，便于管理 | `SSO 协议测试工具` |
| `app_id` | 客户端唯一标识：OAuth2/OIDC 的 `client_id`、远齐 SSO 的 `appid`、SAML 的 issuer 关联键 | 由后台生成（32 位 hex） |
| `app_secret` | 客户端密钥：OAuth2/OIDC 的 `client_secret`、远齐 SSO 的 `corpsecret` | 由后台生成 |
| 可信任站点 `trusted_urls` | 允许的回调域名/主机，**支持端口**，如 `localhost:8000` | 填 `localhost:8000` |
| `status` | `0`=不可用；`1`=可用（严格校验域名/IP）；`2`=可用（测试状态，跳过域名/IP 校验） | 联调期用 `2`，上线前改 `1` |

要点：

- `trusted_urls` 按 **host 精确匹配**：写了 `localhost:8000`，调用方就必须带 `:8000`。OAuth2/OIDC 用它校验 `redirect_uri`，CAS 用 `service` 的 host 匹配，SAML 用 `issuer` 的 host 匹配，远齐 SSO 用 `BackURL` 的域名匹配。
- 若只登记主机名（如 `localhost`），带端口的 `localhost:8000` 也能命中。
- OAuth2/OIDC 支持 `*.example.com` 形式的子域通配。
- 修改许可后存在约 6 秒的内存缓存延迟，必要时重启认证中心服务。

## 各协议测试参数

### OAuth 2.0 / OIDC

| 参数 | OAuth 2.0 页面字段 | OIDC 页面字段 | 说明 |
| --- | --- | --- | --- |
| `client_id` | AppID / client_id | client_id | 对应许可的 `app_id` |
| `client_secret` | CorpSecret / client_secret | client_secret | 对应许可的 `app_secret` |
| `redirect_uri` | redirect_uri | redirect_uri | 默认取当前页面地址；host 必须在 `trusted_urls` 中 |
| `scope` | `snsapi_base`（静默）/ `snsapi_privateinfo`（手动，返回详细资料） | 默认 `openid profile` | — |

### CAS 2.0

| 参数 | 说明 |
| --- | --- |
| `service` | 回调地址，默认 `http://localhost:8000/cas.html`；host 必须在 `trusted_urls` 中 |

### SAML 2.0

| 参数 | 说明 |
| --- | --- |
| `Issuer` | SP 实体标识，默认 `http://localhost:8011`；其 host 需与 `trusted_urls` 匹配 |
| `ACS URL` | 断言消费地址，**应填测试工具地址** `http://localhost:8000/saml/acs`，默认值为示例值，使用前请按实际环境修改 |

SAML 页面会额外展示 `AuthnRequest` 与 `SAMLResponse` 原始 XML，便于排查签名、断言与属性映射问题。

### 远齐 SSO（旧版）

| 参数 | 说明 |
| --- | --- |
| `BackURL` | 回调地址，默认 `http://localhost:8000/yuanqi.html`；域名需与 `trusted_urls` 匹配 |

## 认证中心接口文档

以下为 UIEIP 认证中心对外提供的 SSO 接口（即 `/doc/sso.html` 文档内容），示例中的 `sso.uieip.com` 为占位域名，请替换为实际部署地址。

### OAuth 2.0

#### 接口概览

| 接口名称 | 端点 | HTTP 方法 | 功能描述 |
| --- | --- | --- | --- |
| 获取 access_token | `/connect/auth/gettoken` | GET | 获取应用访问令牌 |
| 构造网页授权链接 | `/connect/auth/authorize` | GET | 用户认证入口点 |
| 获取访问用户身份 | `/connect/auth/getuserinfo` | GET | 根据 code 获取用户 UserID |
| 获取用户详细信息 | `/connect/auth/getuserdetail` | POST | 获取用户详细信息 |
| 单点登出 | `/connect/auth/logout` | GET | 全局会话终止 |
| 令牌撤销 | `/connect/auth/revoketoken` | POST | 撤销 access_token（RFC 7009） |
| 预登录 | `/connect/auth/prelogin` | POST | 登录前预处理（获取登录配置） |
| 登录 | `/connect/auth/login` | POST | 用户名/密码登录 |
| 获取验证码 | `/connect/auth/getverifcode` | POST | 获取图形/短信验证码 |
| 校验验证码 | `/connect/auth/checkverifcode` | POST | 校验验证码 |
| 修改密码 | `/connect/auth/upppw` | POST | 修改用户密码 |
| 第三方授权参数 | `/connect/auth/third/params` | POST | 获取第三方登录授权参数 |
| 第三方授权 | `/connect/auth/third/authorize` | POST | 发起第三方授权 |
| 第三方令牌 | `/connect/auth/third/access_token` | POST | 第三方授权码换取令牌并完成登录 |
| 第三方绑定信息 | `/connect/auth/third/linkinfo` | POST | 查询当前用户的第三方绑定信息 |
| 第三方绑定 | `/connect/auth/third/link` | POST | 绑定第三方账号 |
| 第三方解绑 | `/connect/auth/third/unlink` | POST | 解绑第三方账号 |
| 第三方重定向 | `/connect/auth/third/redirect` | GET | 第三方授权回调重定向 |

#### 1. 获取 access_token

```http
GET /connect/auth/gettoken?appid=ID&corpsecret=SECRET
```

| 参数 | 必须 | 说明 |
| --- | --- | --- |
| `appid` 或 `client_id` | 是 | 应用的 id |
| `corpsecret` 或 `client_secret` | 是 | 应用凭证密钥，应用需为启用状态 |

```json
{
  "errcode": 0,
  "errmsg": "ok",
  "access_token": "accesstoken000001",
  "expires_in": 7200
}
```

说明：每个应用有独立的 `appid`，令牌只能本应用使用；有效期正常情况下为 7200 秒（2 小时），需自行缓存，避免频繁调用触发频率拦截；令牌建议预留至少 512 字节存储空间。

#### 2. 构造网页授权链接

```http
GET /connect/auth/authorize?appid=APPID&redirect_uri=REDIRECT_URI&response_type=code&scope=snsapi_base&state=STATE
```

| 参数 | 必需 | 说明 |
| --- | --- | --- |
| `appid` / `client_id` | 是 | 应用的 id |
| `redirect_uri` | 是 | 回调地址，建议 urlencode；其 host 必须命中应用可信域名白名单 |
| `response_type` | 否 | 缺省补为 `code`，服务端不校验取值，实际仅支持授权码流程 |
| `scope` | 是 | 只要求非空、不校验取值，不弹授权页（静默授权） |
| `state` | 否 | 原样回传，仅允许字母和数字，长度不超过 128 字节 |
| `nonce` | 否 | 防重放随机值，随授权码写入缓存（OAuth2 流程不进入后续响应） |

流程（始终以 302 跳转驱动）：

- 参数或应用校验失败（如 `redirect_uri` 不在白名单，错误码 `10005`）：302 到 `/login/sso_info.html?err=<错误码>&info=<说明>`；
- 已登录：302 到 `redirect_uri?code=<一次性授权码>[&state=<state>]`，授权码一次性、5 分钟内有效；
- 未登录：302 到 `{scheme}://{host}/login/login.html?backurl=<完整授权链接>`，登录后重新进入授权流程。

#### 3. 获取访问用户身份

```http
GET /connect/auth/getuserinfo?appid=ID&access_token=ACCESS_TOKEN&code=CODE
```

| 参数 | 必需 | 说明 |
| --- | --- | --- |
| `appid` / `client_id` | 是 | 应用的 id |
| `access_token` | 是 | 调用接口凭证 |
| `code` | 是 | 授权码，最长 512 字节，一次性、5 分钟有效 |

```json
{
  "errcode": 0,
  "errmsg": "ok",
  "userid": "USERID"
}
```

域名校验：优先取请求头 `Origin`，缺失时回退解析 `Referer` 的 `scheme://host`，不在白名单返回 `10006 域名未授权`；服务端间直连（无 Origin/Referer）不受域名白名单限制，但仍受 IP 白名单约束。

出错时统一返回 HTTP 200，响应体固定 4 个字段（`errcode`/`errmsg`/`access_token`/`expires_in`）：

```json
{
  "errcode": 10020,
  "errmsg": "无效的code：XXXXXXXXXXXXXXXX",
  "access_token": "",
  "expires_in": 0
}
```

#### 4. 获取用户详细信息

```http
POST /connect/auth/getuserdetail?appid=ID&access_token=ACCESS_TOKEN
```

请求包体：`{ "userid": "USERID" }`

成功时直接返回用户字段对象（**不包裹** `errcode`/`errmsg`），字段取自 `hr_user`，仅返回非空字段，剔除 `sid`、`user_id`、`c_userid`、`c_username`、`createtime`、`m_userid`、`m_username`、`modifytime` 等内部字段；存在登录账号时附带 `login_name`、`login_phone`、`login_email`：

```json
{
  "userid": "lisi",
  "user_type": 1,
  "code": "lisi",
  "name": "李四",
  "gender": 1,
  "email": "lisi@yqsite.com",
  "login_name": "lisi",
  "login_phone": "13910000000",
  "login_email": "lisi@yqsite.com"
}
```

出错时返回 HTTP 200 + 固定 4 字段载体，`errcode` 为 `10021`/`10022` 等。

#### 5. 退出

```http
GET /connect/auth/logout?appid=CORPID&redirect_uri=REDIRECT_URI
```

#### 6. 令牌撤销（RFC 7009）

```http
POST /connect/auth/revoketoken
```

| 参数 | 必须 | 说明 |
| --- | --- | --- |
| `client_id` | 是 | 应用的 id |
| `client_secret` | 是 | 应用凭证密钥 |
| `token` | 是 | 需要撤销的 access_token |

返回 `{"errcode":0,"errmsg":"ok"}`。令牌按 appID 存储，撤销即删除缓存键并立即失效；令牌不存在或已过期时仍返回成功，避免泄露令牌状态。

#### 7. 登录相关端点

以下端点统一校验应用凭证（`appid/corpsecret` 或 `client_id/client_secret`）后委托登录模块处理：`/connect/auth/prelogin`（预登录，获取验证码类型、第三方登录选项等）、`/connect/auth/login`、`/connect/auth/getverifcode`、`/connect/auth/checkverifcode`、`/connect/auth/upppw`。凭证参数放 query string，业务参数放 POST 包体。

#### 8. 第三方登录授权端点

| 端点 | HTTP 方法 | 功能 |
| --- | --- | --- |
| `/connect/auth/third/params` | POST | 获取第三方登录授权参数 |
| `/connect/auth/third/authorize` | POST | 发起第三方授权（302 跳转第三方授权页） |
| `/connect/auth/third/access_token` | POST | 第三方授权码换取令牌并完成登录 |
| `/connect/auth/third/linkinfo` | POST | 查询当前用户第三方绑定信息 |
| `/connect/auth/third/link` | POST | 绑定第三方账号 |
| `/connect/auth/third/unlink` | POST | 解绑第三方账号 |
| `/connect/auth/third/redirect` | GET | 第三方授权回调重定向（校验 backurl 域名白名单） |

当前第三方登录仅支持微信；`/connect/auth/third/redirect` 不要求应用凭证，但会校验 `backurl` 域名白名单并拒绝非标准 URI（如 `https:evil.com`）。

#### 9. 常见错误码

| 错误码 | 说明 | 错误码 | 说明 |
| --- | --- | --- | --- |
| 10000 | 参数不存在 | 10013 | scope 不能为空 |
| 10001 | 应用凭证无效 | 10014 | state 长度超限 |
| 10002 | 应用已禁用 | 10015 | state 只能包含字母和数字 |
| 10003 | 应用凭证无效 | 10018 | 生成回调 URL 失败 |
| 10004 | 调用频率超限 | 10019 | 构造授权 URL 失败 |
| 10005 | IP 未授权 | 10020 | 无效的授权码 |
| 10006 | 域名未授权 | 10021 | 无效的访问令牌 |
| 10010 | 生成 token 失败 | 10022 | 无效的用户 ID |
| 10011 | appid 不能为空 | 10012 | redirect_uri 不能为空 |

### OpenID Connect

建立在 OAuth 2.0 之上的身份认证层，流程为：客户端发起认证请求 → 用户认证授权 → 获取 ID Token 与 Access Token → 验证 ID Token → 获取用户信息（可选）。

| 接口名称 | 端点 | HTTP 方法 | 功能描述 |
| --- | --- | --- | --- |
| 配置发现端点 | `/connect/oidc/.well-known/openid-configuration` | GET | 获取 OIDC 服务元数据 |
| 签名公钥 | `/connect/oidc/.well-known/jwks.json` | GET | 获取 ID Token 验签公钥 |
| 授权端点 | `/connect/oidc/authorize` | 任意 | 用户认证入口，复用 OAuth2 授权逻辑 |
| 令牌端点 | `/connect/oidc/token` | POST | 用授权码换取 access_token 与 id_token |
| 令牌刷新 | `/connect/oidc/refreshtoken` | POST | 当前实现不可用，恒返回 HTTP 400 |
| 令牌撤销 | `/connect/oidc/revoketoken` | POST | 撤销 access_token / refresh_token（RFC 7009） |
| 用户信息 | `/connect/oidc/userinfo` | GET/POST | 以 Bearer token 获取已认证用户信息 |
| 登录登出 | `/connect/oidc/logout` | GET | RP-Initiated Logout，清除用户会话 |

#### 1. 配置发现

```http
GET /connect/oidc/.well-known/openid-configuration
```

```json
{
  "issuer": "http://sso.uieip.com/connect/oidc",
  "authorization_endpoint": "http://sso.uieip.com/connect/oidc/authorize",
  "token_endpoint": "http://sso.uieip.com/connect/oidc/token",
  "userinfo_endpoint": "http://sso.uieip.com/connect/oidc/userinfo",
  "jwks_uri": "http://sso.uieip.com/connect/oidc/.well-known/jwks.json",
  "response_types_supported": ["code", "id_token", "token"],
  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["RS256"],
  "scopes_supported": ["openid", "profile", "email"],
  "claims_supported": ["sub", "name", "email", "preferred_username"]
}
```

#### 2. 授权端点

```http
GET /connect/oidc/authorize?client_id=CLIENT_ID&response_type=code&redirect_uri=REDIRECT_URI&scope=openid&state=STATE&nonce=NONCE
```

| 参数 | 必需 | 说明 |
| --- | --- | --- |
| `client_id` | 是 | 应用 id（等价别名 `appid`） |
| `response_type` | 否 | 缺省补为 `code`，仅支持授权码流程 |
| `redirect_uri` | 是 | 回调地址，host 必须命中可信域名白名单 |
| `scope` | 是 | 只要求非空，不弹授权页（静默授权） |
| `state` | 否 | 原样回传，仅字母数字，长度 ≤ 128 字节 |
| `nonce` | 否 | 随授权码写入缓存，并进入 ID Token 的 `nonce` 声明 |

302 流程与 OAuth2 授权端点一致（失败跳 `/login/sso_info.html`，已登录回跳 `redirect_uri?code=...`，未登录跳登录页）。

#### 3. 令牌端点

```http
POST /connect/oidc/token?grant_type=authorization_code&code=CODE&client_id=CLIENT_ID&client_secret=CLIENT_SECRET
```

```json
{
  "id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiI2Zj....",
  "access_token": "b66fcd08c19e47cb9076ff7679d3b72822bd7aed-f114-4c59-9590-204e7d563245",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

`id_token` 使用 RS256 签名，验签公钥取自 jwks 端点。

#### 4. 令牌刷新（当前不可用）

令牌端点响应不含 `refresh_token`，任何对 `/connect/oidc/refreshtoken` 的请求均返回 HTTP 400，不存在成功路径。

#### 5. 令牌撤销

```http
POST /connect/oidc/revoketoken
```

| 参数 | 必需 | 说明 |
| --- | --- | --- |
| `token` | 是 | 需要撤销的 access_token / refresh_token |
| `token_type_hint` | 否 | 令牌类型提示，未提供时依次尝试两种类型 |
| `client_id` | 是 | 应用 id |
| `client_secret` | 是 | 应用密钥 |

#### 6. 用户信息

```http
GET /connect/oidc/userinfo
Authorization: Bearer {access_token}
```

```json
{
  "sub": "22bd7aed-f114-4c59-9590-204e7d563245",
  "user_type": 1,
  "code": "lisi",
  "name": "李四",
  "email": "lisi@yqsite.com",
  "login_name": "lisi",
  "login_phone": "13910000000",
  "login_email": "lisi@yqsite.com"
}
```

`sub` 即用户 `userid`，仅返回非空字段，字段集与 OAuth2 `getuserdetail` 一致，不含 OIDC 标准的 `given_name`/`preferred_username`/`picture` 等声明。

#### 7. 登录退出

```http
GET /connect/oidc/logout?client_id=CLIENT_ID&post_logout_redirect_uri=REDIRECT_URI&state=STATE
```

`client_id` 必填；`post_logout_redirect_uri` 与 `state` 可选，同时提供 `state` 时会原样追加到重定向 URL。

#### 8. ID Token 结构

| 声明 | 固定/可选 | 描述 |
| --- | --- | --- |
| `iss` | 固定 | 签发者，`{scheme}://{host}/connect/oidc` |
| `sub` | 固定 | 用户唯一标识（userid） |
| `aud` | 固定 | 目标受众（client_id） |
| `exp` | 固定 | 过期时间（Unix 时间戳，有效期 60 分钟） |
| `iat` | 固定 | 签发时间（Unix 时间戳） |
| `nonce` | 固定 | 防重放随机值，与授权请求一致 |
| `name` / `code` / `gender` / `birthday` | 可选 | 用户资料字段 |
| `login_name` / `login_phone` / `login_email` | 可选 | 登录账号字段，非空时才写入 |

### CAS 2.0

| 接口名称 | 端点 | HTTP 方法 | 功能描述 |
| --- | --- | --- | --- |
| 认证入口 | `/connect/cas/login` | GET | 用户认证入口点 |
| 票据验证 | `/connect/cas/servicevalidate` | GET | 服务票据验证 |
| 代理流程 | `/connect/cas/proxy` | GET | PT / PGT 代理流程 |
| 获取用户详细信息 | `/connect/cas/getuserdetail` | POST | 获取用户详细信息 |
| 单点登出 | `/connect/cas/logout` | GET | 全局会话终止 |

#### 1. 认证入口

```http
GET /connect/cas/login?service=http://www.uieip.com/callback
```

成功时 302 到 `service` 并附加 `ticket`；未登录时 302 到登录页，登录后经 backurl 回到本端点；service 缺失或域名未授权时返回 HTTP 500 错误文本。

#### 2. 票据验证

```http
GET /connect/cas/servicevalidate?ticket=TICKET&service=SERVICE&format=json
```

`format` 仅支持 `json`/`xml`（大小写敏感），缺省或非法按 `xml` 处理。

成功（JSON）：

```json
{
  "errcode": 0,
  "errmsg": "ok",
  "ticket": "1234567890abcdef",
  "user": "username",
  "attributes": { "login": "user@example.com", "phone": "1234567890", "email": "user@example.com" }
}
```

失败（JSON，沿用统一 token 载体，故含空的 `access_token`/`expires_in`）：

```json
{ "errcode": 50001, "errmsg": "invalid ticket", "access_token": "", "expires_in": 0 }
```

XML 失败时 `code` 取值：`INVALID_TICKET`（票据无效）、`INVALID_SERVICE`（service 缺失/域名未授权）、`INVALID_REQUEST`（参数错误）、`INTERNAL_ERROR`（其他）。JSON 对应 `50001`（票据无效）与 `40001`（service 校验失败）。

#### 3. 代理流程

```http
GET /connect/cas/proxy?pgt=PGT-1234567890&targetService=http://app.uieip.com/service&format=json
```

成功返回 `proxyTicket` 与 `proxyGrantingTicket`；参数缺失或 PGT 无效时 `errcode` 为 `50001`。

#### 4. 获取用户详细信息

```http
POST /connect/cas/getuserdetail?service=http://www.uieip.com/callback
```

请求包体：`{ "userid": "USER" }`

```json
{
  "errcode": 0,
  "errmsg": "ok",
  "attributes": {
    "code": "1",
    "gender": 1,
    "login_email": "dengzw@yqsite.com",
    "login_name": "spring",
    "login_phone": "15210221375",
    "name": "spring",
    "user_type": 1,
    "userid": "22bd7aed-f114-4c59-9590-204e7d563245"
  }
}
```

#### 5. 单点登出

```http
GET /connect/cas/logout?service=https://www.uieip.com/logout
```

`service` 为登出后重定向地址，可选。

### SAML 2.0

本系统作为 SAML 2.0 **IdP** 提供服务：支持 SP 发起登录、HTTP-Redirect（AuthnRequest）与 HTTP-POST（SAML Response）绑定、单点登出（SLO）、IdP 元数据与属性断言。

| 接口名称 | 端点 | HTTP 方法 | 功能描述 |
| --- | --- | --- | --- |
| IdP 元数据 | `/connect/saml/metadata` | GET | 获取 IdP 元数据 XML |
| 应用元数据 | `/connect/saml/appmetadata` | GET | 按应用获取元数据（内容同 IdP 元数据） |
| 登录入口 | `/connect/saml/login` | GET | 接收 SP 的 AuthnRequest |
| 断言消费 | `/connect/saml/acs` | GET | 登录成功后的回调处理 |
| 单点登出 | `/connect/saml/logout` | GET / POST | 单点登出 |
| 接收断言 | `/connect/saml/receiveresponse` | POST | 解析并验证 SAML Response（测试用） |
| 测试登录 | `/connect/saml/testlogin` | GET | 快速测试登录入口 |

#### 1. IdP 元数据

```http
GET /connect/saml/metadata
```

返回 `EntityDescriptor`（`entityID` = `{scheme}://{host}`，`validUntil` = 生成时刻 + 365 天），包含两个 `AssertionConsumerService`（HTTP-POST 指向 `/connect/saml/acs`，HTTP-Redirect 指向 `/connect/saml/login`）与 `SingleLogoutService`。

#### 2. 登录入口

```http
GET /connect/saml/login?SAMLRequest=<Base64 AuthnRequest>&RelayState=https://sp.example.com/callback
```

流程：解码解析 AuthnRequest → 校验 `Issuer` 非空 → 缓存请求状态（request_id、issuer、acs_url）→ 已登录则生成 SAML Response 并自动 POST 到 SP 的 ACS，未登录则跳登录页，成功后回到 `/connect/saml/acs`。

#### 3. 断言消费

```http
GET /connect/saml/acs?RequestID=_abc123
```

根据 `RequestID` 取缓存状态，生成含断言与属性的 SAML Response，以自动提交的 HTML 表单 POST 到 SP 的 ACS URL。

#### 4. 单点登出

- GET：`/connect/saml/logout?RelayState=https://sp.example.com`，清除会话后按 `RelayState`（或 `redirect`）重定向，缺省回站点根 URL；
- POST：处理 `SAMLRequest`（LogoutRequest）并自动回发 LogoutResponse。

#### 5. 接收断言（测试用）

```http
POST /connect/saml/receiveresponse
Content-Type: application/x-www-form-urlencoded

SAMLResponse=<Base64 SAML Response>&RelayState=<state>
```

```json
{
  "errcode": 0,
  "errmsg": "ok",
  "userid": "22bd7aed-f114-4c59-9590-204e7d563245",
  "relayState": "https://sp.example.com",
  "attributes": { "login": "spring", "email": "dengzw@yqsite.com", "phone": "15210221375" }
}
```

#### 6. 测试登录

```http
GET /connect/saml/testlogin?issuer=http://www.uieip.com/&acs=http://localhost:8000/saml/acs
```

`issuer` 缺省为 `http://www.uieip.com/`；`acs` 缺省为 `{issuer}/saml/acs`（`issuer` 以 `/` 结尾时会产生双斜杠）。

#### 7. 集成注意

- NameID 默认使用 `unspecified` 格式，取用户 ID；
- 支持的属性：`login`、`email`、`phone`；
- 当前实现未使用 XML 签名（`AuthnRequestsSigned=false`、`WantAssertionsSigned=false`），生产环境建议启用；
- 登录会话默认 1 小时，断言默认 5 分钟有效。

#### 8. 错误码

| 错误码 | 说明 | 实际返回情况 |
| --- | --- | --- |
| 70001 | 请求参数无效 | 预留，当前无触发路径 |
| 70002 | 应用不存在或已禁用 | 预留，当前无触发路径 |
| 70003 | SAML Response 无效 | `receiveresponse` 返回 |
| 70004 | 会话无效或已过期 | 预留，当前无触发路径 |
| 70005 | ACS URL 无效 | 预留，当前无触发路径 |
| 70006 | Issuer 无效 | 预留，当前无触发路径 |
| 70007 | 断言验证失败 | `receiveresponse` 返回 |

`/connect/saml/login`、`acs`、`logout` 的参数缺失、Base64 或 XML 解析错误返回 **HTTP 400 纯文本**；`metadata`/`testlogin` 内部生成失败返回 HTTP 500。

### 远齐 SSO（旧版）

兼容远齐旧版 asp.net 系统的网页登录协议，端点以 `/sso/` 开头，另有根级 `/_login.html`、`/_accinfo.html` 兼容入口。路径匹配大小写不敏感；方法与约定不符返回 `405`，`/sso/` 前缀下无匹配端点返回 `404 无效的请求路径`。

密码迁移格式：`{YUANQI}` + 密码哈希 + 盐（兼容 asp.net 密文，算法为 SHA1(UTF-16LE 密码 + 盐) 后 Base64）。

| 接口名称 | 端点 | HTTP 方法 | 功能描述 |
| --- | --- | --- | --- |
| 网页授权（获取 Token） | `/sso/userlogin.html`（别名 `/sso/userlogin1.html`、`/sso/gettoken.html`） | GET | 已登录则回跳 BackURL 并附加 Token，未登录则跳登录页 |
| 获取访问用户身份 | `/sso/_accinfo.html` | POST | 用一次性 Token 换取用户身份信息 |
| 登录兼容 | `/_login.html?ctype=...` | POST | 旧系统用户名/密码登录入口 |
| 单点登出 | `/sso/clstoken.html` | GET | 删除当前会话 `userId` 并重定向回 BackURL |

#### 1. 网页授权

```http
GET /sso/userlogin.html?BackURL=http%3A%2F%2Fwww.uieip.com%2Fsso%2Flogin.html
```

`BackURL` 必填（参数名大小写不敏感）；若取值以 `http%3A%2F%2F` 或 `https%3A%2F%2F` 开头会先做一次 URL 解码。回跳时：含 `$Token$` 占位符则替换为授权码，否则追加 `Token=<授权码>`；含 `$IP$` 则替换为访问者 IP，否则追加 `IP=<访问者IP>`。授权码一次性、5 分钟有效。

#### 2. 获取访问用户身份

```http
POST /sso/_accinfo.html?action=token&token=TOKEN
```

| 参数 | 必须 | 说明 |
| --- | --- | --- |
| `action` | 否 | 固定 `token`（缺省即 `token`），其他取值返回 HTTP 400 |
| `token` | 是 | 一次性授权码，使用后立即作废，5 分钟过期 |
| `tag` | 否 | 缺省 `server`；`local` 时跳过访问者 IP 白名单校验 |

```json
{
  "error": 0,
  "userId": "22bd7aed-f114-4c59-9590-204e7d563245",
  "changePass": false,
  "checkPE": false,
  "token": "code",
  "nickname": "ocean",
  "loginName": "spring",
  "phone": "13910000000",
  "email": "spring@yqsite.com",
  "modifyTime": "2025/01/12 12:04:23"
}
```

`token` 恒为字符串 `"code"`（旧版占位值，以 `userId` 为准）。出错时沿用统一载体（含空 `access_token`/`expires_in`），`6004`=IP 未授权、`6005`=Token 无效或读取用户失败。

#### 3. 登录兼容

```http
POST /_login.html?ctype=1&name=spring
{明文密码}
```

`ctype` 存在即进入兼容登录（取值不校验）；`action` 缺省 `login`，`getsvr`/`linksvr` 恒返回 `{"error":9,"info":"不允许创建连接"}`。密码支持 `{spring}` 前缀（会先剥离）。成功返回结构同 `/sso/_accinfo.html`。

#### 4. 单点登出

```http
GET /sso/clstoken.html?BackURL=http%3A%2F%2Fwww.uieip.com%2F
```

删除当前会话 `userId`（仅本认证中心），随后 302 到 `BackURL`；为空时回跳 `scheme://host/`。

#### 5. 错误码

| 错误码 | 说明 | 出现位置 |
| --- | --- | --- |
| 6000 | BackURL 参数不存在 | 授权入口：302 到 `sso_info.html?err=6000` |
| 6001 | 域名不匹配（含应用未启用/超频） | 授权入口 |
| 6002 | 构造回调 URL 错误 | 授权入口 |
| 6003 | 构造授权 URL 错误 | 授权入口 |
| 6004 | IP 地址不允许 | accinfo / 登录兼容：JSON |
| 6005 | 获取并验证用户信息错误 | accinfo：JSON |
| 6006 | 用户名或密码错误 | 登录兼容：JSON |
| 6007 | 用户已被注销 | 登录兼容：JSON |
| 6008 | 用户未设置密码 | 登录兼容：JSON |
| 6009 | 密码错误 | 登录兼容：JSON |
| 6010 | 用户不存在 | 登录兼容：JSON |

### LDAP

为支持 LDAP 模式登录验证（如深信服 VPN），系统内置 LDAP Service，提供 Bind、Search 服务。

| 配置项 | 值 |
| --- | --- |
| LDAP Version | 3 |
| Base DN | `dc=yqsite,dc=com`（可配置） |
| 端口 | 389（可配置） |
| 用户验证 | Username：`cn=spring,dc=yqsite,dc=com`；Password：密码 |

## 测试工具后端 API

测试工具自身提供的接口，所有接口返回 JSON（`errcode=0` 表示成功），凭证交换均在服务端完成。

### OAuth 2.0

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/api/oauth2/start` | POST | 获取 `access_token`，返回授权跳转 URL |
| `/api/oauth2/callback` | POST | 用 `code` 换取用户身份，`snsapi_privateinfo` 时附带详细资料 |
| `/api/oauth2/logout` | POST | 清理会话并返回退出登录 URL |

### OpenID Connect

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/api/oidc/start` | POST | 保存会话，返回授权跳转 URL |
| `/api/oidc/callback` | POST | 用 `code` 换取 `access_token` 并调用 userinfo |
| `/api/oidc/logout` | POST | 清理会话并返回登出 URL |

### CAS 2.0

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/api/cas/start` | POST | 返回 CAS 登录跳转 URL |
| `/api/cas/callback` | POST | 校验 `ticket` 并拉取用户详细属性 |
| `/api/cas/logout` | POST | 清理会话并返回登出 URL |

### SAML 2.0

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/api/saml/start` | POST | 构造 `AuthnRequest`，返回登录跳转 URL |
| `/saml/acs` | POST | SP 断言消费端点，接收 IdP 的 `SAMLResponse` 并解析 |
| `/api/saml/callback` | POST | 按 `requestId` 读取会话中的用户信息 |
| `/api/saml/logout` | POST | 清理会话并返回登出 URL |

### 远齐 SSO（旧版）

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/api/yuanqi/start` | POST | 返回旧版登录跳转 URL |
| `/api/yuanqi/callback` | POST | 用 `Token` 换取用户信息 |
| `/api/yuanqi/logout` | POST | 清理会话并返回登出 URL |

## 测试流程

1. **准备环境**：安装并启动 UIEIP 认证中心，确认访问地址。
2. **准备应用**：在认证中心登记许可，拿到 `app_id` / `app_secret`，把 `localhost:8000` 加入可信任站点。
3. **配置工具**：设置 `server.js` 中的 `SSO_BASE`，启动服务。
4. **发起登录**：打开对应协议页面，填写参数后点击 **SSO 登录**。
5. **完成认证**：在认证中心页面输入测试账号登录。
6. **校验结果**：确认回调成功、UserID 与用户属性正确、头像可加载；SAML 还需核对断言内容。
7. **退出登录**：点击 **退出登录**，确认跳转到认证中心登出页面且会话已清理。
8. **回归**：重启工具进程即可清空会话，重新执行上述步骤。

## 常见问题

| 现象 | 可能原因 | 处理方式 |
| --- | --- | --- |
| `The application does not exist.` | 许可未登记，或 `app_id` 与许可不一致 | 在「许可管理」中新增许可并核对 `app_id` |
| `redirect_uri` / `service` / `BackURL` 校验失败 | `trusted_urls` 未包含工具地址，或端口写法不一致 | 把 `localhost:8000` 写入 `trusted_urls`；端口需与访问地址一致 |
| 一直跳到线上登录页 | `SSO_BASE` 仍指向生产地址 | 改为本地/测试认证中心地址后重启 |
| 无法连接认证中心 | UIEIP 未安装或未启动 | 参考[前置条件](#前置条件安装-uieip)完成安装并确认端口 |
| “session 已失效，请重新登录” | 进程重启、会话超时或 `appid`/`client_id` 与发起登录时不一致 | 重新点击 **SSO 登录** |
| 获取 `access_token` 失败 | `app_secret` 错误，或许可状态为不可用 | 核对密钥与 `status` |
| SAML 回调 400 / “SAML 响应解析失败” | `ACS URL` 指向错误，或 `Issuer` 未通过校验 | 将 ACS 改为 `http://localhost:8000/saml/acs`，核对 `Issuer` 与 `trusted_urls` |
| 端口被占用（`EADDRINUSE`） | 8000 端口已被占用 | 修改 `server.js` 中的 `PORT`，并同步更新许可的 `trusted_urls` |
| 头像不显示 | 用户资料未上传头像，或认证中心地址不可访问 | 检查用户资料与 `SSO_BASE` 连通性 |

## 安全说明

- 页面内的 `app_id` / `app_secret` 为**演示值**，公开发布或部署到共享环境前请替换为测试专用许可，避免泄露真实密钥。
- `session.secret` 为演示常量，对外部署前务必修改。
- 认证中心侧联调期可使用 `status=2`，**正式上线前必须改为 `status=1`**，否则任意域名都能发起认证。
- 本工具仅用于协议联调与验收，不包含权限控制、限流、审计等生产级能力。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 后端 | Node.js + Express 4 |
| 会话 | express-session（内存存储） |
| HTTP 客户端 | axios |
| 前端 | 原生 HTML + JavaScript + Bootstrap 5.3.3 |

主要依赖：[express](https://expressjs.com/)、[express-session](https://github.com/expressjs/session)、[axios](https://axios-http.com/)、[Bootstrap 5](https://getbootstrap.com/)。

## 参与贡献

欢迎通过 Issue 反馈问题、提交 Pull Request 改进实现。请保持单个 PR 聚焦于一个协议或一个明确问题，并在提交前本地跑通对应协议的完整登录链路。

## 许可证

本项目基于 [Apache License 2.0](./LICENSE) 开源。

```
Copyright 2026 Yuanqi Technology (Beijing) Co., Ltd.
```
