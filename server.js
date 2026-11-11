const express = require('express');
const session = require('express-session');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 8000;
const SSO_BASE = 'http://localhost:8011';

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'sso-test-secret-key-yuanqi',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 60 * 1000 } // 30分钟
}));

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 创建 axios 实例用于请求 SSO 服务
const ssoClient = axios.create({
  baseURL: SSO_BASE,
  timeout: 10000,
  validateStatus: () => true // 不抛出 HTTP 错误
});

// ==================== OAuth 2.0 ====================

// 步骤1: 获取 access_token 并返回授权 URL
app.post('/api/oauth2/start', async (req, res) => {
  try {
    const { appid, corpsecret, redirectUri, scope } = req.body;
    if (!appid || !corpsecret || !redirectUri) {
      return res.json({ errcode: -1, errmsg: '参数不完整' });
    }

    // 服务端获取 access_token
    const tokenResp = await ssoClient.get('/connect/auth/gettoken', {
      params: { appid, corpsecret }
    });

    if (tokenResp.data.errcode !== 0 || !tokenResp.data.access_token) {
      return res.json({ errcode: tokenResp.data.errcode || -1, errmsg: tokenResp.data.errmsg || '获取 access_token 失败' });
    }

    // 存储到 session（同时保存 scope）
    req.session.oauth2 = {
      appid,
      access_token: tokenResp.data.access_token,
      scope: scope || 'snsapi_base'
    };

    // 构建授权 URL（前端跳转用）
    const authorizeUrl = `${SSO_BASE}/connect/auth/authorize?appid=${encodeURIComponent(appid)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope || 'snsapi_base')}&state=${Date.now()}`;

    res.json({ errcode: 0, authorizeUrl });
  } catch (err) {
    console.error('OAuth2 start error:', err.message);
    res.json({ errcode: -1, errmsg: '服务端错误: ' + err.message });
  }
});

// 步骤2: 服务端使用 code 获取用户信息
app.post('/api/oauth2/callback', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.json({ errcode: -1, errmsg: '缺少 code 参数' });
    }

    const oauth2Session = req.session.oauth2;
    if (!oauth2Session || !oauth2Session.access_token) {
      return res.json({ errcode: -1, errmsg: 'access_token 已失效，请重新登录' });
    }

    const { appid, access_token, scope } = oauth2Session;

    // 服务端获取用户身份
    const userInfoResp = await ssoClient.get('/connect/auth/getuserinfo', {
      params: { appid, access_token, code }
    });

    if (userInfoResp.data.errcode !== 0) {
      return res.json({ errcode: userInfoResp.data.errcode, errmsg: userInfoResp.data.errmsg || '获取用户身份失败' });
    }

    const userid = userInfoResp.data.userid;

    // 存储到 session
    req.session.oauth2.userid = userid;

    // snsapi_privateinfo 才获取详细信息
    if (scope === 'snsapi_privateinfo') {
      const detailResp = await ssoClient.post('/connect/auth/getuserdetail', 
        { userid },
        { params: { appid, access_token } }
      );

      req.session.oauth2.userDetail = detailResp.data;

      return res.json({
        errcode: 0,
        userid,
        userDetail: detailResp.data,
        ssoBase: SSO_BASE
      });
    }

    // snsapi_base：只返回基础信息
    res.json({
      errcode: 0,
      userid,
      ssoBase: SSO_BASE
    });
  } catch (err) {
    console.error('OAuth2 callback error:', err.message);
    res.json({ errcode: -1, errmsg: '服务端错误: ' + err.message });
  }
});

// 退出登录
app.post('/api/oauth2/logout', (req, res) => {
  const appid = req.session.oauth2?.appid || '';
  const redirectUri = req.body.redirectUri || '';
  req.session.oauth2 = null;

  const logoutUrl = `${SSO_BASE}/connect/oauth2/logout?appid=${encodeURIComponent(appid)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  res.json({ errcode: 0, logoutUrl });
});

// ==================== OIDC ====================

app.post('/api/oidc/start', async (req, res) => {
  try {
    const { clientId, redirectUri, scope, nonce } = req.body;
    if (!clientId || !redirectUri) {
      return res.json({ errcode: -1, errmsg: '参数不完整' });
    }

    // 存储参数到 session（后续 callback 使用）
    req.session.oidc = req.body;

    // 构建授权 URL
    const authorizeUrl = `${SSO_BASE}/connect/oidc/authorize?client_id=${encodeURIComponent(clientId)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope || 'openid profile')}&state=${Date.now()}&nonce=${encodeURIComponent(nonce || '')}`;

    res.json({ errcode: 0, authorizeUrl });
  } catch (err) {
    console.error('OIDC start error:', err.message);
    res.json({ errcode: -1, errmsg: '服务端错误: ' + err.message });
  }
});

app.post('/api/oidc/callback', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.json({ errcode: -1, errmsg: '缺少 code 参数' });
    }

    const oidcSession = req.session.oidc;
    if (!oidcSession) {
      return res.json({ errcode: -1, errmsg: 'session 已失效，请重新登录' });
    }

    const { clientId, clientSecret, redirectUri } = oidcSession;

    // 服务端用 code 换取 token
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('redirect_uri', redirectUri);

    const tokenResp = await ssoClient.post('/connect/oidc/token', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (!tokenResp.data.access_token) {
      return res.json({ errcode: -1, errmsg: tokenResp.data.errmsg || '换取 token 失败' });
    }

    const accessToken = tokenResp.data.access_token;

    // 服务端获取用户信息
    const userInfoResp = await ssoClient.get('/connect/oidc/userinfo', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    req.session.oidc.accessToken = accessToken;
    req.session.oidc.userInfo = userInfoResp.data;

    res.json({
      errcode: 0,
      accessToken,
      userInfo: userInfoResp.data,
      sub: userInfoResp.data.sub || '',
      ssoBase: SSO_BASE
    });
  } catch (err) {
    console.error('OIDC callback error:', err.message);
    res.json({ errcode: -1, errmsg: '服务端错误: ' + err.message });
  }
});

app.post('/api/oidc/logout', (req, res) => {
  const clientId = req.session.oidc?.clientId || '';
  const redirectUri = req.body.redirectUri || '';
  req.session.oidc = null;

  const logoutUrl = `${SSO_BASE}/connect/oidc/logout?client_id=${encodeURIComponent(clientId)}&post_logout_redirect_uri=${encodeURIComponent(redirectUri)}&state=${Date.now()}`;
  res.json({ errcode: 0, logoutUrl });
});

// ==================== CAS 2.0 ====================

app.post('/api/cas/start', (req, res) => {
  try {
    const { service } = req.body;
    if (!service) {
      return res.json({ errcode: -1, errmsg: '缺少 service 参数' });
    }

    req.session.cas = { service };

    const loginUrl = `${SSO_BASE}/connect/cas/login?service=${encodeURIComponent(service)}`;
    res.json({ errcode: 0, loginUrl });
  } catch (err) {
    console.error('CAS start error:', err.message);
    res.json({ errcode: -1, errmsg: '服务端错误: ' + err.message });
  }
});

app.post('/api/cas/callback', async (req, res) => {
  try {
    const { ticket, service } = req.body;
    if (!ticket || !service) {
      return res.json({ errcode: -1, errmsg: '缺少 ticket 或 service 参数' });
    }

    // 服务端验证 ticket
    const validateResp = await ssoClient.get('/connect/cas/servicevalidate', {
      params: { ticket, service, format: 'json' }
    });

    if (validateResp.data.errcode !== 0) {
      return res.json({ errcode: validateResp.data.errcode, errmsg: validateResp.data.errmsg || '验证 ticket 失败' });
    }

    const userName = validateResp.data.user || '';

    // 服务端获取用户详细信息
    const detailResp = await ssoClient.post('/connect/cas/getuserdetail', 
      { userid: userName },
      { params: { service } }
    );

    const userDetail = detailResp.data.attributes || {};

    req.session.cas = { ...req.session.cas, userName, userDetail };

    res.json({
      errcode: 0,
      userName,
      userDetail,
      ssoBase: SSO_BASE
    });
  } catch (err) {
    console.error('CAS callback error:', err.message);
    res.json({ errcode: -1, errmsg: '服务端错误: ' + err.message });
  }
});

app.post('/api/cas/logout', (req, res) => {
  const service = req.session.cas?.service || '';
  req.session.cas = null;

  const logoutUrl = `${SSO_BASE}/connect/cas/logout?service=${encodeURIComponent(service)}`;
  res.json({ errcode: 0, logoutUrl });
});

// ==================== 远齐 SSO（旧版） ====================

app.post('/api/yuanqi/start', (req, res) => {
  try {
    const { backUrl } = req.body;
    if (!backUrl) {
      return res.json({ errcode: -1, errmsg: '缺少 BackURL 参数' });
    }

    req.session.yuanqi = { backUrl };

    const loginUrl = `${SSO_BASE}/sso/userlogin.html?BackURL=${encodeURIComponent(backUrl)}`;
    res.json({ errcode: 0, loginUrl });
  } catch (err) {
    console.error('Yuanqi start error:', err.message);
    res.json({ errcode: -1, errmsg: '服务端错误: ' + err.message });
  }
});

app.post('/api/yuanqi/callback', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.json({ errcode: -1, errmsg: '缺少 Token 参数' });
    }

    // 服务端获取用户信息
    const infoResp = await ssoClient.post(`/sso/_accinfo.html?action=token&token=${encodeURIComponent(token)}`, {});

    if (infoResp.data.error !== 0) {
      return res.json({ errcode: infoResp.data.error || -1, errmsg: infoResp.data.info || '获取用户信息失败' });
    }

    req.session.yuanqi = {
      ...req.session.yuanqi,
      userInfo: infoResp.data,
      userId: infoResp.data.userId || '',
      nickname: infoResp.data.nickname || ''
    };

    res.json({
      errcode: 0,
      userInfo: infoResp.data,
      userId: infoResp.data.userId || '',
      nickname: infoResp.data.nickname || '',
      ssoBase: SSO_BASE
    });
  } catch (err) {
    console.error('Yuanqi callback error:', err.message);
    res.json({ errcode: -1, errmsg: '服务端错误: ' + err.message });
  }
});

app.post('/api/yuanqi/logout', (req, res) => {
  const backUrl = req.session.yuanqi?.backUrl || '';
  req.session.yuanqi = null;

  const logoutUrl = `${SSO_BASE}/sso/clstoken.html?BackURL=${encodeURIComponent(backUrl)}`;
  res.json({ errcode: 0, logoutUrl });
});

// ==================== SAML 2.0 ====================

// SAML request state store (in-memory)
const samlRequestStore = {};

// POST /saml/acs - SP 端的 Assertion Consumer Service 端点
// 接收 IdP 自动 POST 过来的 SAML Response
app.post('/saml/acs', async (req, res) => {
  try {
    const samlResponse = req.body.SAMLResponse;
    const relayState = req.body.RelayState || '';

    if (!samlResponse) {
      return res.status(400).send('Missing SAMLResponse');
    }

    // 解析 SAMLResponse Base64 → 原始 XML
    let samlResponseXml = '';
    try {
      samlResponseXml = atob(samlResponse);
    } catch(e) {
      try {
        samlResponseXml = atob(samlResponse.replace(/-/g, '+').replace(/_/g, '/'));
      } catch(e2) {
        samlResponseXml = 'Base64 解码失败';
      }
    }

    // 将 SAMLResponse 发给 SSO 服务解析
    const parseResp = await ssoClient.post('/connect/saml/receiveresponse',
      new URLSearchParams({ SAMLResponse: samlResponse, RelayState: relayState }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        validateStatus: () => true
      }
    );

    if (parseResp.data.errcode !== 0) {
      console.error('SAML Response 解析失败:', parseResp.data.errmsg);
      return res.status(400).send('SAML 响应解析失败');
    }

    // 获取用户详细信息（包含 icon）
    let userDetail = null;
    const issuer = relayState || '';
    if (issuer && parseResp.data.userid) {
      try {
        const detailResp = await ssoClient.post('/connect/cas/getuserdetail',
          { userid: parseResp.data.userid },
          { params: { service: issuer } }
        );
        if (detailResp.data.errcode === 0) {
          userDetail = detailResp.data.attributes || {};
        }
      } catch (e) {
        console.error('获取用户详情失败:', e.message);
      }
    }

    // 生成唯一的请求ID 并存储用户信息到 session
    const requestId = '_req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    req.session.saml = {
      requestId,
      userId: parseResp.data.userid,
      attributes: parseResp.data.attributes || {},
      relayState,
      samlResponseXml,
      userDetail,
      ssoBase: SSO_BASE
    };

    // 重定向回测试页面
    res.redirect(`/saml.html?RequestID=${requestId}`);
  } catch (err) {
    console.error('SAML ACS error:', err.message);
    res.status(500).send('SAML ACS 处理失败: ' + err.message);
  }
});

// 步骤1: 开始 SAML 登录 — 构造标准 AuthnRequest 发给 IdP
app.post('/api/saml/start', async (req, res) => {
  try {
    const { issuer, acsUrl } = req.body;
    if (!issuer) {
      return res.json({ errcode: -1, errmsg: '缺少 issuer 参数' });
    }

    const spAcsUrl = acsUrl || (issuer + '/saml/acs');
    req.session.saml = { issuer, acsUrl: spAcsUrl };

    // 生成 AuthnRequest ID（格式同 SSO 服务端）
    const requestId = '_' + require('crypto').randomUUID().replace(/-/g, '');

    // 构建 AuthnRequest XML
    const authnRequestXml = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                     xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                     ID="${requestId}"
                     Version="2.0"
                     IssueInstant="${new Date().toISOString()}"
                     Destination="${SSO_BASE}/connect/saml/login"
                     AssertionConsumerServiceURL="${spAcsUrl}"
                     ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
  <saml:Issuer>${issuer}</saml:Issuer>
  <samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified"
                      AllowCreate="true"/>
</samlp:AuthnRequest>`;

    // Base64 编码
    const authnB64 = Buffer.from(authnRequestXml, 'utf-8').toString('base64');

    // 构建标准 SAML login URL（通过 HTTP-Redirect 绑定发送 AuthnRequest）
    const loginUrl = `${SSO_BASE}/connect/saml/login?SAMLRequest=${encodeURIComponent(authnB64)}&RelayState=${encodeURIComponent(issuer)}`;

    // 同时缓存 requestId 用于后续匹配（SSO 服务端也会缓存同样 ID）
    req.session.saml.requestId = requestId;

    res.json({
      errcode: 0,
      loginUrl,
      authnRequestXml
    });
  } catch (err) {
    console.error('SAML start error:', err.message);
    res.json({ errcode: -1, errmsg: '服务端错误: ' + err.message });
  }
});

// 步骤2: 登录回调 - 获取用户信息
app.post('/api/saml/callback', async (req, res) => {
  try {
    const { requestId } = req.body;
    if (!requestId) {
      return res.json({ errcode: -1, errmsg: '缺少 requestId 参数' });
    }

    const samlSession = req.session.saml;
    if (!samlSession || samlSession.requestId !== requestId) {
      return res.json({ errcode: -1, errmsg: 'session 已失效或 requestId 不匹配，请重新登录' });
    }

    res.json({
      errcode: 0,
      userId: samlSession.userId || '',
      relayState: samlSession.relayState || '',
      attributes: samlSession.attributes || {},
      samlResponseXml: samlSession.samlResponseXml || '',
      userDetail: samlSession.userDetail || null,
      ssoBase: samlSession.ssoBase || ''
    });
  } catch (err) {
    console.error('SAML callback error:', err.message);
    res.json({ errcode: -1, errmsg: '服务端错误: ' + err.message });
  }
});

// 退出登录
app.post('/api/saml/logout', (req, res) => {
  const issuer = req.session.saml?.issuer || '';
  req.session.saml = null;

  const logoutUrl = `${SSO_BASE}/connect/saml/logout?RelayState=${encodeURIComponent(issuer)}`;
  res.json({ errcode: 0, logoutUrl });
});

// 启动服务
app.listen(PORT, () => {
  console.log(`SSO 测试服务已启动: http://localhost:${PORT}`);
  console.log(`SSO 服务地址: ${SSO_BASE}`);
});
