# Yuanqi SSO Protocol Test Tool (ssotest)

[![GitHub](https://img.shields.io/badge/GitHub-uieip%2Fyuanqi--open-181717?logo=github)](https://github.com/uieip/yuanqi-open)
[![Gitee](https://img.shields.io/badge/Gitee-uieip%2Fyuanqi--open-C71D23?logo=gitee)](https://gitee.com/uieip/yuanqi-open)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D16-339933?logo=node.js)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)

[简体中文](./README.md) | English

A protocol integration and acceptance test tool for the **Yuanqi Unified Identity and Access Management Center (UIEIP / Yuanqi SSO)**. It verifies that the authorization redirect, credential exchange, user-info retrieval and single logout flows of a business system's SSO integration behave as expected.

> This tool is intended for **development and test environments only**. Do not deploy it directly as a production business system.

- GitHub: <https://github.com/uieip/yuanqi-open>
- Gitee: <https://gitee.com/uieip/yuanqi-open>

## Table of Contents

- [Features](#features)
- [Supported Protocols](#supported-protocols)
- [Prerequisite: Install UIEIP](#prerequisite-install-uieip)
- [How It Works](#how-it-works)
- [Project Layout](#project-layout)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Registering the Application (License Management)](#registering-the-application-license-management)
- [Protocol Test Parameters](#protocol-test-parameters)
- [Authentication Center API Reference](#authentication-center-api-reference)
  - [OAuth 2.0](#oauth-20)
  - [OpenID Connect](#openid-connect)
  - [CAS 2.0](#cas-20)
  - [SAML 2.0](#saml-20)
  - [Yuanqi SSO (Legacy)](#yuanqi-sso-legacy)
  - [LDAP](#ldap)
- [Test Tool Backend API](#test-tool-backend-api)
- [Test Workflow](#test-workflow)
- [FAQ](#faq)
- [Security Notes](#security-notes)
- [Tech Stack](#tech-stack)
- [Contributing](#contributing)
- [License](#license)

## Features

- Covers five mainstream integration protocols: OAuth 2.0, OpenID Connect, CAS 2.0, SAML 2.0 and legacy Yuanqi SSO.
- **All credential exchange happens server-side**: `access_token`, `code`, `ticket`, `Token` and `SAMLResponse` never appear in browser-visible requests, mirroring a real business integration.
- Every protocol page provides a parameter form, login status panel, error alerts and user information (including avatar) display.
- Full **login → callback → display → logout** loop can be verified on a single page.
- Plain static frontend (HTML + vanilla JS + Bootstrap 5) with no build step — run it right after `npm install`.
- `express-session` keeps protocol context; restarting the process invalidates sessions, which is convenient for repeated regression tests.
- Built-in protocol API descriptions and error-code appendices for troubleshooting.

## Supported Protocols

| Protocol | Description | Test Page | Backend Route Prefix |
| --- | --- | --- | --- |
| **OAuth 2.0** | Standard authorization code flow, silent / manual scope | [`public/oauth2.html`](public/oauth2.html) | `/api/oauth2/*` |
| **OpenID Connect** | Identity layer on top of OAuth 2.0, with userinfo | [`public/oidc.html`](public/oidc.html) | `/api/oidc/*` |
| **CAS 2.0** | Central Authentication Service, ticket validation | [`public/cas.html`](public/cas.html) | `/api/cas/*` |
| **SAML 2.0** | HTTP-Redirect request / HTTP-POST response | [`public/saml.html`](public/saml.html) | `/api/saml/*`, `/saml/acs` |
| **Yuanqi SSO (Legacy)** | Legacy `BackURL` + `Token` model | [`public/yuanqi.html`](public/yuanqi.html) | `/api/yuanqi/*` |
| **LDAP** | Built-in LDAP service (Bind/Search) for VPN and similar systems | — (no test page) | Connect with any LDAP client |

The homepage [`public/index.html`](public/index.html) is the protocol navigation page.

## Prerequisite: Install UIEIP

This repository is **only a protocol test tool** and does not provide authentication itself. You must have a reachable **UIEIP (Yuanqi Unified Identity and Access Management Center)** instance acting as the SSO authentication center.

- GitHub repository: <https://github.com/uieip/yuanqi-open>
- Gitee repository: <https://gitee.com/uieip/yuanqi-open>

For download and installation, follow the README on the repository homepage and the **Releases** page:

1. Open either repository (GitHub and Gitee are kept in sync; Gitee is usually faster from mainland China).
2. Go to **Releases** and download the package for your platform (or build from source as described in the README).
3. Complete the initialization and start the authentication center as described in the deployment section.
4. Note the authentication center URL (for example `http://localhost:8011`) — it is used as `SSO_BASE` below.

> The tool connects to `http://localhost:8011` by default. If your deployment uses a different host or port, change `SSO_BASE` in `server.js` (see [Configuration](#configuration)).

## How It Works

```
┌──────────────────────────────┐   HTTP    ┌─────────────────────────────┐
│  Test Tool (ssotest)         │ ────────► │  UIEIP / Yuanqi SSO Center  │
│  Node.js + Express           │           │  Authorize / Token / User   │
│  http://localhost:8000       │ ◄──────── │  http://localhost:8011      │
│  Redirect / exchange / show  │  redirect │                             │
└──────────────────────────────┘           └─────────────────────────────┘
```

1. Fill in the application parameters and click **SSO Login**.
2. The browser calls the test tool backend (e.g. `/api/oauth2/start`), which obtains credentials from the authentication center and returns the authorization URL.
3. The browser is redirected to the authentication center to authenticate; the center then calls back to the test page with `code` / `ticket` / `Token` / `SAMLResponse`.
4. The frontend hands the credential to the backend, which performs the credential exchange and user-info lookup.
5. The frontend displays the UserID, user attributes, avatar and (for SAML) the raw protocol messages.

## Project Layout

```
yuanqi-open/                 # Repository root
├── public/                  # Frontend test pages (static assets)
│   ├── index.html           # Homepage: protocol navigation
│   ├── oauth2.html          # OAuth 2.0 test page
│   ├── oidc.html            # OpenID Connect test page
│   ├── cas.html             # CAS 2.0 test page
│   ├── saml.html            # SAML 2.0 test page (with AuthnRequest / Response viewer)
│   ├── yuanqi.html          # Legacy Yuanqi SSO test page
│   └── lib/bootstrap-5.3.3/ # Local Bootstrap assets
├── server.js                # Test tool backend (Express, core logic)
├── package.json             # Dependencies and scripts
├── package-lock.json        # Dependency lock file
├── README.md                # Chinese documentation
├── README.en.md             # English documentation (this file)
├── LICENSE                  # Apache License 2.0
└── .gitignore               # Ignores node_modules, dist, etc.
```

## Quick Start

### Requirements

- Node.js >= 16 (18 LTS or later recommended)
- An installed and reachable UIEIP authentication center (see [Prerequisite](#prerequisite-install-uieip))

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the authentication center

Edit the two constants at the top of [`server.js`](server.js#L7-L9):

```js
const PORT = 8000;                          // Test tool port
const SSO_BASE = 'http://localhost:8011';   // UIEIP authentication center
```

- `SSO_BASE` must be reachable from **both the browser and the server**; use the real domain if the center runs remotely (e.g. `http://user.example.com`).
- If both production and local centers exist, make sure `SSO_BASE` points to the local one before testing.

### 3. Start

```bash
npm start
```

Expected console output:

```
SSO 测试服务已启动: http://localhost:8000
SSO 服务地址: http://localhost:8011
```

### 4. Verify

1. Open <http://localhost:8000>.
2. Pick a protocol and fill in the parameters (see [Protocol Test Parameters](#protocol-test-parameters)).
3. Click **SSO Login**; after authentication the browser should return to the test page and show user information.

## Configuration

| Setting | Location | Description | Default |
| --- | --- | --- | --- |
| `PORT` | [`server.js`](server.js#L7) | Test tool listening port | `8000` |
| `SSO_BASE` | [`server.js`](server.js#L8) | UIEIP base URL, used to build redirect URLs and call APIs | `http://localhost:8011` |
| `session.secret` | [`server.js`](server.js#L14) | Session signing secret; change it before shared deployments | `sso-test-secret-key-yuanqi` |
| `session.cookie.maxAge` | [`server.js`](server.js#L17) | Session lifetime | 30 minutes |

> Sessions are kept in process memory. Restarting `server.js` invalidates in-flight test sessions ("session 已失效，请重新登录"); simply click login again.

## Registering the Application (License Management)

The authentication center only accepts requests from registered applications; otherwise it returns `The application does not exist.` Register the app first:

**Organization & Permission Management → License Management** (table `app_client`)

| Admin Field | Description | Suggested Value (Test) |
| --- | --- | --- |
| Name | Application label, for management only | `SSO Protocol Test Tool` |
| `app_id` | Client identifier: OAuth2/OIDC `client_id`, legacy SSO `appid`, SAML issuer key | Generated by the console (32-hex) |
| `app_secret` | Client secret: OAuth2/OIDC `client_secret`, legacy SSO `corpsecret` | Generated by the console |
| Trusted sites `trusted_urls` | Allowed callback hosts, **port supported**, e.g. `localhost:8000` | `localhost:8000` |
| `status` | `0`=disabled; `1`=enabled (strict host/IP checks); `2`=enabled (test mode, skips host/IP checks) | `2` during integration, `1` before go-live |

Notes:

- `trusted_urls` matches **the host exactly**: if you register `localhost:8000`, callers must include `:8000`. OAuth2/OIDC validates `redirect_uri` with it, CAS matches the `service` host, SAML matches the `issuer` host, and legacy SSO matches the `BackURL` domain.
- If only the hostname is registered (e.g. `localhost`), `localhost:8000` also matches.
- OAuth2/OIDC supports wildcard subdomains such as `*.example.com`.
- Changes to licenses are cached in memory for a short period (about 6 seconds); restart the authentication center if needed.

## Protocol Test Parameters

### OAuth 2.0 / OIDC

| Parameter | OAuth 2.0 Page Field | OIDC Page Field | Description |
| --- | --- | --- | --- |
| `client_id` | AppID / client_id | client_id | Maps to `app_id` |
| `client_secret` | CorpSecret / client_secret | client_secret | Maps to `app_secret` |
| `redirect_uri` | redirect_uri | redirect_uri | Defaults to the current page URL; host must be in `trusted_urls` |
| `scope` | `snsapi_base` (silent) / `snsapi_privateinfo` (manual, returns details) | Default `openid profile` | — |

### CAS 2.0

| Parameter | Description |
| --- | --- |
| `service` | Callback URL, default `http://localhost:8000/cas.html`; host must be in `trusted_urls` |

### SAML 2.0

| Parameter | Description |
| --- | --- |
| `Issuer` | SP entity ID, default `http://localhost:8011`; its host must match `trusted_urls` |
| `ACS URL` | Assertion Consumer Service URL; **should point to the test tool** at `http://localhost:8000/saml/acs`. The default is a sample value — adjust it for your environment |

The SAML page also shows the raw `AuthnRequest` and `SAMLResponse` XML for signature, assertion and attribute-mapping troubleshooting.

### Yuanqi SSO (Legacy)

| Parameter | Description |
| --- | --- |
| `BackURL` | Callback URL, default `http://localhost:8000/yuanqi.html`; its domain must match `trusted_urls` |

## Authentication Center API Reference

The APIs below are exposed by the UIEIP authentication center (the content of `/doc/sso.html`). Replace the placeholder domain `sso.uieip.com` with your deployment address.

### OAuth 2.0

#### Endpoint Overview

| Endpoint | Method | Description |
| --- | --- | --- |
| `/connect/auth/gettoken` | GET | Get the application access token |
| `/connect/auth/authorize` | GET | User authentication entry point |
| `/connect/auth/getuserinfo` | GET | Resolve the UserID from `code` |
| `/connect/auth/getuserdetail` | POST | Get detailed user profile |
| `/connect/auth/logout` | GET | Terminate the global session |
| `/connect/auth/revoketoken` | POST | Revoke an access token (RFC 7009) |
| `/connect/auth/prelogin` | POST | Pre-login (fetch login configuration) |
| `/connect/auth/login` | POST | Username/password login |
| `/connect/auth/getverifcode` | POST | Get image / SMS verification code |
| `/connect/auth/checkverifcode` | POST | Verify the code |
| `/connect/auth/upppw` | POST | Change the user password |
| `/connect/auth/third/params` | POST | Get third-party authorization parameters |
| `/connect/auth/third/authorize` | POST | Start third-party authorization |
| `/connect/auth/third/access_token` | POST | Exchange the third-party code and complete login |
| `/connect/auth/third/linkinfo` | POST | Query third-party binding info |
| `/connect/auth/third/link` | POST | Bind a third-party account |
| `/connect/auth/third/unlink` | POST | Unbind a third-party account |
| `/connect/auth/third/redirect` | GET | Third-party authorization callback redirect |

#### 1. Get access_token

```http
GET /connect/auth/gettoken?appid=ID&corpsecret=SECRET
```

| Parameter | Required | Description |
| --- | --- | --- |
| `appid` or `client_id` | Yes | Application ID |
| `corpsecret` or `client_secret` | Yes | Application secret; the app must be enabled |

```json
{
  "errcode": 0,
  "errmsg": "ok",
  "access_token": "accesstoken000001",
  "expires_in": 7200
}
```

Each application has its own token; cache it (normally valid for 7200 seconds / 2 hours) and avoid frequent calls, which are rate-limited. Reserve at least 512 bytes for the token.

#### 2. Build the web authorization URL

```http
GET /connect/auth/authorize?appid=APPID&redirect_uri=REDIRECT_URI&response_type=code&scope=snsapi_base&state=STATE
```

| Parameter | Required | Description |
| --- | --- | --- |
| `appid` / `client_id` | Yes | Application ID |
| `redirect_uri` | Yes | Callback URL (urlencode recommended); its host must be in the trusted-domain whitelist |
| `response_type` | No | Defaults to `code`; not validated, only the authorization code flow is supported |
| `scope` | Yes | Must be non-empty; not validated and no consent page is shown (silent authorization) |
| `state` | No | Returned unchanged; letters and digits only, up to 128 bytes |
| `nonce` | No | Anti-replay value stored with the code (not returned in the OAuth2 response) |

The endpoint always responds with HTTP 302:

- Validation failure (e.g. `redirect_uri` not whitelisted, error `10005`): 302 to `/login/sso_info.html?err=<code>&info=<message>`;
- Already logged in: 302 to `redirect_uri?code=<one-time code>[&state=<state>]`; the code is single-use and valid for 5 minutes;
- Not logged in: 302 to `{scheme}://{host}/login/login.html?backurl=<full authorize URL>`, then back to the authorization flow after login.

#### 3. Get the user identity

```http
GET /connect/auth/getuserinfo?appid=ID&access_token=ACCESS_TOKEN&code=CODE
```

| Parameter | Required | Description |
| --- | --- | --- |
| `appid` / `client_id` | Yes | Application ID |
| `access_token` | Yes | Access token |
| `code` | Yes | Authorization code (max 512 bytes, single-use, 5 minutes) |

```json
{
  "errcode": 0,
  "errmsg": "ok",
  "userid": "USERID"
}
```

Domain validation uses the `Origin` header, falling back to the `scheme://host` parsed from `Referer`; unauthorized origins get `10006 域名未授权`. Server-to-server calls without Origin/Referer are exempt from the domain whitelist but still subject to the IP whitelist.

Errors always return HTTP 200 with four fixed fields:

```json
{
  "errcode": 10020,
  "errmsg": "无效的code：XXXXXXXXXXXXXXXX",
  "access_token": "",
  "expires_in": 0
}
```

#### 4. Get detailed user profile

```http
POST /connect/auth/getuserdetail?appid=ID&access_token=ACCESS_TOKEN
```

Request body: `{ "userid": "USERID" }`

On success the raw user object is returned (**without** `errcode`/`errmsg`). Fields come from `hr_user`, only non-empty fields are returned, and internal fields (`sid`, `user_id`, `c_userid`, `c_username`, `createtime`, `m_userid`, `m_username`, `modifytime`) are removed. If a login account exists, `login_name`, `login_phone` and `login_email` are appended:

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

On error the fixed four-field envelope is returned with `10021` / `10022` etc.

#### 5. Logout

```http
GET /connect/auth/logout?appid=CORPID&redirect_uri=REDIRECT_URI
```

#### 6. Token revocation (RFC 7009)

```http
POST /connect/auth/revoketoken
```

| Parameter | Required | Description |
| --- | --- | --- |
| `client_id` | Yes | Application ID |
| `client_secret` | Yes | Application secret |
| `token` | Yes | Access token to revoke |

Returns `{"errcode":0,"errmsg":"ok"}`. Tokens are stored per app ID, so revocation deletes the cache key immediately. Following RFC 7009, unknown or expired tokens still return success to avoid leaking token state.

#### 7. Login-related endpoints

After validating client credentials (`appid/corpsecret` or `client_id/client_secret`), these endpoints delegate to the login module: `/connect/auth/prelogin` (verification-code type, third-party options), `/connect/auth/login`, `/connect/auth/getverifcode`, `/connect/auth/checkverifcode`, `/connect/auth/upppw`. Credentials go in the query string, business parameters in the POST body.

#### 8. Third-party login endpoints

| Endpoint | Method | Description |
| --- | --- | --- |
| `/connect/auth/third/params` | POST | Get third-party authorization parameters |
| `/connect/auth/third/authorize` | POST | Start third-party authorization (302 redirect) |
| `/connect/auth/third/access_token` | POST | Exchange the third-party code and complete login |
| `/connect/auth/third/linkinfo` | POST | Query the current user's third-party binding |
| `/connect/auth/third/link` | POST | Bind a third-party account |
| `/connect/auth/third/unlink` | POST | Unbind a third-party account |
| `/connect/auth/third/redirect` | GET | Callback redirect (validates the backurl domain) |

Only WeChat is supported today. `/connect/auth/third/redirect` does not require client credentials but validates the `backurl` domain and rejects non-standard URIs (e.g. `https:evil.com`).

#### 9. Common error codes

| Code | Description | Code | Description |
| --- | --- | --- | --- |
| 10000 | Missing parameter | 10013 | scope is empty |
| 10001 | Invalid client credentials | 10014 | state too long |
| 10002 | Application disabled | 10015 | state must be alphanumeric |
| 10003 | Invalid client credentials | 10018 | Failed to build callback URL |
| 10004 | Rate limit exceeded | 10019 | Failed to build authorize URL |
| 10005 | IP not authorized | 10020 | Invalid authorization code |
| 10006 | Domain not authorized | 10021 | Invalid access token |
| 10010 | Failed to generate token | 10022 | Invalid user ID |
| 10011 | appid is empty | 10012 | redirect_uri is empty |

### OpenID Connect

An identity layer on top of OAuth 2.0: client initiates authentication → user authenticates and authorizes → client obtains ID Token and Access Token → validates the ID Token → optionally fetches userinfo.

| Endpoint | Method | Description |
| --- | --- | --- |
| `/connect/oidc/.well-known/openid-configuration` | GET | OIDC service metadata |
| `/connect/oidc/.well-known/jwks.json` | GET | ID Token verification keys |
| `/connect/oidc/authorize` | Any | Authentication entry, reuses OAuth2 authorization |
| `/connect/oidc/token` | POST | Exchange the code for access_token and id_token |
| `/connect/oidc/refreshtoken` | POST | Currently unavailable, always HTTP 400 |
| `/connect/oidc/revoketoken` | POST | Revoke access_token / refresh_token (RFC 7009) |
| `/connect/oidc/userinfo` | GET/POST | Get the authenticated user with a Bearer token |
| `/connect/oidc/logout` | GET | RP-Initiated Logout |

#### 1. Discovery

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

#### 2. Authorization endpoint

```http
GET /connect/oidc/authorize?client_id=CLIENT_ID&response_type=code&redirect_uri=REDIRECT_URI&scope=openid&state=STATE&nonce=NONCE
```

| Parameter | Required | Description |
| --- | --- | --- |
| `client_id` | Yes | Application ID (alias `appid`) |
| `response_type` | No | Defaults to `code`; only the authorization code flow exists |
| `redirect_uri` | Yes | Callback URL; host must be in the trusted-domain whitelist |
| `scope` | Yes | Must be non-empty; silent authorization, no consent page |
| `state` | No | Returned unchanged; alphanumeric, ≤ 128 bytes |
| `nonce` | No | Stored with the code and included in the ID Token `nonce` claim |

The 302 flow matches OAuth2 (errors to `/login/sso_info.html`, callback with `code`, login page when unauthenticated).

#### 3. Token endpoint

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

`id_token` is signed with RS256; verification keys come from the jwks endpoint.

#### 4. Token refresh (currently unavailable)

The token response contains no `refresh_token`, so every call to `/connect/oidc/refreshtoken` returns HTTP 400; there is no successful path.

#### 5. Token revocation

```http
POST /connect/oidc/revoketoken
```

| Parameter | Required | Description |
| --- | --- | --- |
| `token` | Yes | access_token or refresh_token to revoke |
| `token_type_hint` | No | Optional hint; both types are tried when omitted |
| `client_id` | Yes | Application ID |
| `client_secret` | Yes | Application secret |

#### 6. UserInfo

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

`sub` is the user `userid`. Only non-empty fields are returned; the field set matches OAuth2 `getuserdetail` and does not include standard OIDC claims such as `given_name`, `preferred_username` or `picture`.

#### 7. Logout

```http
GET /connect/oidc/logout?client_id=CLIENT_ID&post_logout_redirect_uri=REDIRECT_URI&state=STATE
```

`client_id` is required; `post_logout_redirect_uri` and `state` are optional, and `state` is appended to the redirect URL when provided.

#### 8. ID Token structure

| Claim | Fixed/Optional | Description |
| --- | --- | --- |
| `iss` | Fixed | Issuer, `{scheme}://{host}/connect/oidc` |
| `sub` | Fixed | User identifier (userid) |
| `aud` | Fixed | Audience (client_id) |
| `exp` | Fixed | Expiry (Unix timestamp, 60 minutes) |
| `iat` | Fixed | Issued at (Unix timestamp) |
| `nonce` | Fixed | Anti-replay value matching the request |
| `name` / `code` / `gender` / `birthday` | Optional | User profile fields |
| `login_name` / `login_phone` / `login_email` | Optional | Login account fields, only when non-empty |

### CAS 2.0

| Endpoint | Method | Description |
| --- | --- | --- |
| `/connect/cas/login` | GET | Authentication entry point |
| `/connect/cas/servicevalidate` | GET | Service ticket validation |
| `/connect/cas/proxy` | GET | PT / PGT proxy flow |
| `/connect/cas/getuserdetail` | POST | Detailed user profile |
| `/connect/cas/logout` | GET | Terminate the global session |

#### 1. Authentication entry

```http
GET /connect/cas/login?service=http://www.uieip.com/callback
```

On success the client is redirected (302) to `service` with a `ticket`; unauthenticated users go to the login page and return here afterwards; a missing or unauthorized `service` yields HTTP 500 with an error text.

#### 2. Ticket validation

```http
GET /connect/cas/servicevalidate?ticket=TICKET&service=SERVICE&format=json
```

`format` only accepts `json`/`xml` (case-sensitive); default or invalid values fall back to `xml`.

Success (JSON):

```json
{
  "errcode": 0,
  "errmsg": "ok",
  "ticket": "1234567890abcdef",
  "user": "username",
  "attributes": { "login": "user@example.com", "phone": "1234567890", "email": "user@example.com" }
}
```

Failure (JSON, using the shared token envelope, hence the empty `access_token`/`expires_in`):

```json
{ "errcode": 50001, "errmsg": "invalid ticket", "access_token": "", "expires_in": 0 }
```

XML `code` values: `INVALID_TICKET`, `INVALID_SERVICE`, `INVALID_REQUEST`, `INTERNAL_ERROR`; JSON equivalents are `50001` (invalid ticket) and `40001` (service validation failed).

#### 3. Proxy flow

```http
GET /connect/cas/proxy?pgt=PGT-1234567890&targetService=http://app.uieip.com/service&format=json
```

Returns `proxyTicket` and `proxyGrantingTicket`; missing parameters or an invalid PGT yield `50001`.

#### 4. Detailed user profile

```http
POST /connect/cas/getuserdetail?service=http://www.uieip.com/callback
```

Body: `{ "userid": "USER" }`

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

#### 5. Logout

```http
GET /connect/cas/logout?service=https://www.uieip.com/logout
```

`service` is the optional post-logout redirect URL.

### SAML 2.0

The system acts as a SAML 2.0 **IdP**: SP-initiated login, HTTP-Redirect (AuthnRequest) and HTTP-POST (SAML Response) bindings, single logout (SLO), IdP metadata and attribute assertions.

| Endpoint | Method | Description |
| --- | --- | --- |
| `/connect/saml/metadata` | GET | IdP metadata XML |
| `/connect/saml/appmetadata` | GET | Per-application metadata (same content) |
| `/connect/saml/login` | GET | Receives the SP AuthnRequest |
| `/connect/saml/acs` | GET | Post-login callback handling |
| `/connect/saml/logout` | GET / POST | Single logout |
| `/connect/saml/receiveresponse` | POST | Parse and verify a SAML Response (testing) |
| `/connect/saml/testlogin` | GET | Quick test login entry |

#### 1. IdP metadata

```http
GET /connect/saml/metadata
```

Returns an `EntityDescriptor` (`entityID` = `{scheme}://{host}`, `validUntil` = issue time + 365 days) with two `AssertionConsumerService` entries (HTTP-POST → `/connect/saml/acs`, HTTP-Redirect → `/connect/saml/login`) and a `SingleLogoutService`.

#### 2. Login entry

```http
GET /connect/saml/login?SAMLRequest=<Base64 AuthnRequest>&RelayState=https://sp.example.com/callback
```

Flow: decode and parse the AuthnRequest → require a non-empty `Issuer` → cache the request state (request_id, issuer, acs_url) → if authenticated, generate the SAML Response and auto-POST it to the SP ACS; otherwise redirect to the login page and return to `/connect/saml/acs` afterwards.

#### 3. Assertion consumption

```http
GET /connect/saml/acs?RequestID=_abc123
```

Looks up the cached state by `RequestID`, generates a SAML Response with assertions and attributes, and auto-submits an HTML form POST to the SP ACS URL.

#### 4. Single logout

- GET: `/connect/saml/logout?RelayState=https://sp.example.com` — clears the session and redirects to `RelayState` (or `redirect`), defaulting to the site root;
- POST: processes the `SAMLRequest` (LogoutRequest) and posts a LogoutResponse back.

#### 5. Receive assertion (testing)

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

#### 6. Test login

```http
GET /connect/saml/testlogin?issuer=http://www.uieip.com/&acs=http://localhost:8000/saml/acs
```

`issuer` defaults to `http://www.uieip.com/`; `acs` defaults to `{issuer}/saml/acs` (a trailing `/` produces a double slash).

#### 7. Integration notes

- NameID uses the `unspecified` format and carries the user ID;
- Supported attributes: `login`, `email`, `phone`;
- XML signing is not used (`AuthnRequestsSigned=false`, `WantAssertionsSigned=false`); enable it in production;
- Login sessions last 1 hour by default; assertions are valid for 5 minutes.

#### 8. Error codes

| Code | Description | Actual usage |
| --- | --- | --- |
| 70001 | Invalid request parameter | Reserved, no trigger path |
| 70002 | Application missing or disabled | Reserved, no trigger path |
| 70003 | Invalid SAML Response | Returned by `receiveresponse` |
| 70004 | Session invalid or expired | Reserved, no trigger path |
| 70005 | Invalid ACS URL | Reserved, no trigger path |
| 70006 | Invalid Issuer | Reserved, no trigger path |
| 70007 | Assertion verification failed | Returned by `receiveresponse` |

Missing parameters, Base64 or XML parse errors on `/connect/saml/login`, `acs` and `logout` return **HTTP 400 plain text**; generation failures in `metadata`/`testlogin` return HTTP 500.

### Yuanqi SSO (Legacy)

Compatible with the legacy Yuanqi ASP.NET web login protocol. Endpoints start with `/sso/`, plus root-level `/_login.html` and `/_accinfo.html` compatibility entries. Path matching is case-insensitive; a wrong HTTP method returns `405`, and an unmatched `/sso/` path returns `404 无效的请求路径`.

Password migration format: `{YUANQI}` + password hash + salt (ASP.NET compatible; SHA1(UTF-16LE password + salt), Base64-encoded).

| Endpoint | Method | Description |
| --- | --- | --- |
| `/sso/userlogin.html` (aliases `/sso/userlogin1.html`, `/sso/gettoken.html`) | GET | Redirect back to BackURL with a Token, or go to the login page |
| `/sso/_accinfo.html` | POST | Exchange the one-time Token for user identity |
| `/_login.html?ctype=...` | POST | Legacy username/password login entry |
| `/sso/clstoken.html` | GET | Clear the session `userId` and redirect to BackURL |

#### 1. Web authorization

```http
GET /sso/userlogin.html?BackURL=http%3A%2F%2Fwww.uieip.com%2Fsso%2Flogin.html
```

`BackURL` is required (case-insensitive name). Values starting with `http%3A%2F%2F` or `https%3A%2F%2F` are URL-decoded once. On redirect, `$Token$` is replaced by the code (otherwise `Token=<code>` is appended), and `$IP$` is replaced by the visitor IP (otherwise `IP=<ip>` is appended). The code is single-use and valid for 5 minutes.

#### 2. Get the user identity

```http
POST /sso/_accinfo.html?action=token&token=TOKEN
```

| Parameter | Required | Description |
| --- | --- | --- |
| `action` | No | Fixed to `token` (also the default); other values return HTTP 400 |
| `token` | Yes | One-time code, invalidated after use, expires in 5 minutes |
| `tag` | No | Defaults to `server`; `local` skips the visitor IP whitelist |

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

`token` is always the string `"code"` (legacy placeholder; rely on `userId`). Errors use the shared envelope (with empty `access_token`/`expires_in`): `6004` = IP not authorized, `6005` = invalid token or user lookup failure.

#### 3. Login compatibility

```http
POST /_login.html?ctype=1&name=spring
{plaintext password}
```

Presence of `ctype` triggers this handler (value not validated). `action` defaults to `login`; `getsvr`/`linksvr` always return `{"error":9,"info":"不允许创建连接"}`. A `{spring}` password prefix is stripped before validation. Success returns the same structure as `/sso/_accinfo.html`.

#### 4. Logout

```http
GET /sso/clstoken.html?BackURL=http%3A%2F%2Fwww.uieip.com%2F
```

Clears the session `userId` (this center only) and 302-redirects to `BackURL`; when empty it redirects to `scheme://host/`.

#### 5. Error codes

| Code | Description | Where |
| --- | --- | --- |
| 6000 | BackURL missing | Authorize entry: 302 to `sso_info.html?err=6000` |
| 6001 | Domain mismatch (includes disabled/rate-limited app) | Authorize entry |
| 6002 | Failed to build callback URL | Authorize entry |
| 6003 | Failed to build authorize URL | Authorize entry |
| 6004 | IP not allowed | accinfo / login compatibility: JSON |
| 6005 | Failed to verify user info | accinfo: JSON |
| 6006 | Wrong username or password | Login compatibility: JSON |
| 6007 | User deleted | Login compatibility: JSON |
| 6008 | User has no password | Login compatibility: JSON |
| 6009 | Wrong password | Login compatibility: JSON |
| 6010 | User not found | Login compatibility: JSON |

### LDAP

To support LDAP-based login validation (e.g. Sangfor VPN), the system ships a built-in LDAP service providing Bind and Search.

| Item | Value |
| --- | --- |
| LDAP version | 3 |
| Base DN | `dc=yqsite,dc=com` (configurable) |
| Port | 389 (configurable) |
| Bind | Username: `cn=spring,dc=yqsite,dc=com`; Password: the user password |

## Test Tool Backend API

APIs exposed by the test tool itself. All return JSON (`errcode=0` means success) and perform credential exchange server-side.

### OAuth 2.0

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/oauth2/start` | POST | Get `access_token` and return the authorization URL |
| `/api/oauth2/callback` | POST | Exchange `code` for user identity; returns details for `snsapi_privateinfo` |
| `/api/oauth2/logout` | POST | Clear the session and return the logout URL |

### OpenID Connect

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/oidc/start` | POST | Save the session and return the authorization URL |
| `/api/oidc/callback` | POST | Exchange `code` for `access_token` and call userinfo |
| `/api/oidc/logout` | POST | Clear the session and return the logout URL |

### CAS 2.0

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/cas/start` | POST | Return the CAS login URL |
| `/api/cas/callback` | POST | Validate the `ticket` and fetch detailed attributes |
| `/api/cas/logout` | POST | Clear the session and return the logout URL |

### SAML 2.0

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/saml/start` | POST | Build an `AuthnRequest` and return the login URL |
| `/saml/acs` | POST | SP assertion consumer endpoint; parses the IdP `SAMLResponse` |
| `/api/saml/callback` | POST | Read user info from the session by `requestId` |
| `/api/saml/logout` | POST | Clear the session and return the logout URL |

### Yuanqi SSO (Legacy)

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/yuanqi/start` | POST | Return the legacy login URL |
| `/api/yuanqi/callback` | POST | Exchange `Token` for user info |
| `/api/yuanqi/logout` | POST | Clear the session and return the logout URL |

## Test Workflow

1. **Prepare the environment**: install and start the UIEIP authentication center and confirm its URL.
2. **Prepare the application**: register a license, note `app_id` / `app_secret`, and add `localhost:8000` to the trusted sites.
3. **Configure the tool**: set `SSO_BASE` in `server.js` and start the service.
4. **Start login**: open the protocol page, fill in the parameters and click **SSO Login**.
5. **Authenticate**: log in with a test account on the authentication center.
6. **Verify**: confirm the callback, UserID and attributes, and that the avatar loads; for SAML, review the assertion content.
7. **Log out**: click **Logout** and confirm the redirect and session cleanup.
8. **Regression**: restart the process to clear sessions and repeat.

## FAQ

| Symptom | Likely Cause | Resolution |
| --- | --- | --- |
| `The application does not exist.` | License not registered, or `app_id` mismatch | Register the license in License Management and verify `app_id` |
| `redirect_uri` / `service` / `BackURL` rejected | Tool URL missing from `trusted_urls`, or port mismatch | Add `localhost:8000` to `trusted_urls`; keep the port consistent |
| Always redirected to the production login page | `SSO_BASE` still points to production | Point it to the local/test center and restart |
| Cannot reach the authentication center | UIEIP not installed or not running | Follow [Prerequisite](#prerequisite-install-uieip) and check the port |
| "session 已失效，请重新登录" | Process restarted, session expired, or `appid`/`client_id` changed | Click **SSO Login** again |
| Failed to get `access_token` | Wrong `app_secret`, or license disabled | Verify the secret and `status` |
| SAML callback 400 / "SAML 响应解析失败" | Wrong `ACS URL`, or `Issuer` rejected | Set ACS to `http://localhost:8000/saml/acs` and check `Issuer` against `trusted_urls` |
| `EADDRINUSE` | Port 8000 already in use | Change `PORT` in `server.js` and update `trusted_urls` |
| Avatar not shown | User has no avatar, or center unreachable | Check the user profile and `SSO_BASE` connectivity |

## Security Notes

- The `app_id` / `app_secret` values on the pages are **demo values**. Replace them with a test-only license before publishing or deploying to a shared environment.
- `session.secret` is a demo constant; change it before any external deployment.
- `status=2` is acceptable during integration, but **must be changed to `status=1` before go-live**, otherwise any domain can initiate authentication.
- This tool is for integration and acceptance testing only; it has no permission control, rate limiting or auditing.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Backend | Node.js + Express 4 |
| Session | express-session (in-memory store) |
| HTTP client | axios |
| Frontend | Vanilla HTML + JavaScript + Bootstrap 5.3.3 |

Main dependencies: [express](https://expressjs.com/), [express-session](https://github.com/expressjs/session), [axios](https://axios-http.com/), [Bootstrap 5](https://getbootstrap.com/).

## Contributing

Issues and pull requests are welcome. Keep each PR focused on a single protocol or a single well-defined problem, and run the complete login flow of the affected protocol locally before submitting.

## License

This project is open source under the [Apache License 2.0](./LICENSE).

```
Copyright 2026 Yuanqi Technology (Beijing) Co., Ltd.
```
