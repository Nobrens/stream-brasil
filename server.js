const http = require("http");
const fs = require("fs");
const path = require("path");

function loadLocalEnv() {
  const envPath = path.join(__dirname, ".env");

  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) return;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");

    if (key && process.env[key] == null) {
      process.env[key] = value;
    }
  });
}

loadLocalEnv();

const root = __dirname;
const port = Number(process.env.PORT || 5500);
const host = process.env.HOST || "0.0.0.0";
const twitchApiBase = "https://api.twitch.tv/helix";
const twitchAuthUrl = "https://id.twitch.tv/oauth2/token";

let appTokenCache = {
  token: "",
  expiresAt: 0,
};

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

const publicExtensions = new Set([".html", ".css", ".js", ".png", ".jpg", ".jpeg", ".svg", ".webmanifest"]);
const publicFiles = new Set([
  "index.html",
  "styles.css",
  "app.js",
  "site-config.js",
  "admin.html",
  "admin.js",
  "manifest.webmanifest",
  "sw.js",
]);
const assetsRoot = path.join(root, "assets");
const dataRoot = path.join(root, "data");
const siteDataPath = path.join(dataRoot, "site-data.json");
const analyticsPath = path.join(dataRoot, "analytics.json");
const statsCache = new Map();
const statsCacheMs = 30_000;

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.google.com https://*.gstatic.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://cdn.betterttv.net https://static-cdn.jtvnw.net https://*.googleusercontent.com https://*.gstatic.com https://*.googlesyndication.com",
    "connect-src 'self' https://api.betterttv.net https://cdn.betterttv.net https://*.google.com https://*.googlesyndication.com",
    "frame-src https://player.twitch.tv https://www.twitch.tv https://*.google.com https://*.googlesyndication.com https://*.doubleclick.net",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
};

function withSecurityHeaders(headers = {}) {
  return { ...securityHeaders, ...headers };
}

function ensureDataFiles() {
  fs.mkdirSync(dataRoot, { recursive: true });

  if (!fs.existsSync(siteDataPath)) {
    fs.writeFileSync(siteDataPath, JSON.stringify({
      supportLink: "",
      sponsorText: "Espaco aberto para patrocinadores da comunidade gamer.",
      featuredPresets: [
        { name: "CS BR", channels: ["gaules", "loud_coringa"] },
        { name: "Variedades", channels: ["alanzoka", "cellbit", "casimito", "baiano"] },
      ],
      streamers: [],
      updatedAt: new Date().toISOString(),
    }, null, 2));
  }

  if (!fs.existsSync(analyticsPath)) {
    fs.writeFileSync(analyticsPath, JSON.stringify({
      pageViews: 0,
      events: {},
      channels: {},
      updatedAt: new Date().toISOString(),
    }, null, 2));
  }
}

ensureDataFiles();

function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function cleanLogin(value) {
  const login = String(value || "").trim().toLowerCase().replace(/^@/, "");
  return /^[a-z0-9_]{3,25}$/.test(login) ? login : "";
}

function cleanText(value, maxLength = 180) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength);
}

function cleanUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function cleanHost(value) {
  const host = String(value || "").toLowerCase();
  return /^[a-z0-9.-]+(?::\d+)?$/.test(host) ? host : "stream-brasil-1.onrender.com";
}

function sanitizeSiteData(input) {
  const presets = Array.isArray(input.featuredPresets) ? input.featuredPresets : [];
  const streamers = Array.isArray(input.streamers) ? input.streamers : [];

  return {
    supportLink: cleanUrl(input.supportLink),
    sponsorText: cleanText(input.sponsorText, 220),
    featuredPresets: presets.slice(0, 12).map((preset) => ({
      name: cleanText(preset.name, 40) || "Preset",
      channels: (Array.isArray(preset.channels) ? preset.channels : [])
        .map(cleanLogin)
        .filter(Boolean)
        .slice(0, 6),
    })).filter((preset) => preset.channels.length),
    streamers: streamers.slice(0, 40).map((streamer) => {
      const login = cleanLogin(streamer.login);
      return {
        login,
        name: cleanText(streamer.name, 50) || login,
        category: cleanText(streamer.category, 60) || "Twitch",
        custom: true,
      };
    }).filter((streamer) => streamer.login),
    updatedAt: new Date().toISOString(),
  };
}

function readSiteData() {
  return sanitizeSiteData(readJsonFile(siteDataPath, {}));
}

function hasAdminAccess(request) {
  const adminToken = process.env.ADMIN_TOKEN || "";
  if (!adminToken) return false;
  const authorization = request.headers.authorization || "";
  return authorization === `Bearer ${adminToken}`;
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    ...withSecurityHeaders({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    }),
  });
  response.end(JSON.stringify(payload));
}

function readRequestBody(request, limit = 64_000) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error("payload_too_large"));
        request.destroy();
      }
    });

    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function cleanChannels(value) {
  return String(value || "")
    .split(",")
    .map((channel) => channel.trim().toLowerCase())
    .filter((channel) => /^[a-z0-9_]{3,25}$/.test(channel))
    .slice(0, 20);
}

async function getAppAccessToken() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("missing_twitch_env");
  }

  if (appTokenCache.token && appTokenCache.expiresAt > Date.now() + 60_000) {
    return { clientId, token: appTokenCache.token };
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });

  const response = await fetch(twitchAuthUrl, {
    method: "POST",
    body,
  });

  if (!response.ok) {
    throw new Error(`twitch_auth_${response.status}`);
  }

  const payload = await response.json();
  appTokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + Math.max(0, payload.expires_in - 120) * 1000,
  };

  return { clientId, token: appTokenCache.token };
}

async function twitchGet(pathname, tokenData, tokenOverride) {
  const response = await fetch(`${twitchApiBase}/${pathname}`, {
    headers: {
      "Client-ID": tokenData.clientId,
      Authorization: `Bearer ${tokenOverride || tokenData.token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`twitch_${response.status}`);
  }

  return response.json();
}

function buildRepeatedQuery(key, values) {
  const params = new URLSearchParams();
  values.forEach((value) => params.append(key, value));
  return params.toString();
}

async function getFollowerTotal(userId, tokenData) {
  const followerToken = process.env.TWITCH_USER_ACCESS_TOKEN || tokenData.token;

  try {
    const payload = await twitchGet(
      `channels/followers?broadcaster_id=${encodeURIComponent(userId)}&first=1`,
      tokenData,
      followerToken,
    );

    return {
      total: typeof payload.total === "number" ? payload.total : null,
      available: typeof payload.total === "number",
      note: "Total oficial da Twitch",
    };
  } catch (error) {
    return {
      total: null,
      available: false,
      note: "Configure TWITCH_USER_ACCESS_TOKEN se o total nao aparecer",
    };
  }
}

async function handleTwitchStats(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const channels = cleanChannels(url.searchParams.get("channels"));

  if (!channels.length) {
    sendJson(response, 400, { configured: false, message: "Nenhum canal valido enviado.", channels: [] });
    return;
  }

  const cacheKey = channels.slice().sort().join(",");
  const cached = statsCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    sendJson(response, 200, cached.payload);
    return;
  }

  try {
    const tokenData = await getAppAccessToken();
    const userPayload = await twitchGet(`users?${buildRepeatedQuery("login", channels)}`, tokenData);
    const users = userPayload.data || [];
    const ids = users.map((user) => user.id);

    const [streamPayload, channelPayload] = await Promise.all([
      twitchGet(`streams?${buildRepeatedQuery("user_login", channels)}`, tokenData),
      ids.length ? twitchGet(`channels?${buildRepeatedQuery("broadcaster_id", ids)}`, tokenData) : { data: [] },
    ]);

    const streamsByLogin = new Map((streamPayload.data || []).map((stream) => [stream.user_login.toLowerCase(), stream]));
    const channelsById = new Map((channelPayload.data || []).map((channel) => [channel.broadcaster_id, channel]));
    const followersById = new Map(
      await Promise.all(
        users.map(async (user) => [user.id, await getFollowerTotal(user.id, tokenData)]),
      ),
    );

    const data = users.map((user) => {
      const stream = streamsByLogin.get(user.login.toLowerCase());
      const channelInfo = channelsById.get(user.id);
      const followers = followersById.get(user.id) || { total: null, available: false, note: "Indisponivel" };

      return {
        id: user.id,
        login: user.login,
        displayName: user.display_name,
        profileImageUrl: user.profile_image_url,
        description: user.description,
        isLive: Boolean(stream),
        viewerCount: stream?.viewer_count ?? null,
        title: stream?.title || channelInfo?.title || "",
        gameName: stream?.game_name || channelInfo?.game_name || "",
        startedAt: stream?.started_at || null,
        followerTotal: followers.total,
        followersAvailable: followers.available,
        followersNote: followers.note,
      };
    });

    const payload = {
      configured: true,
      generatedAt: new Date().toISOString(),
      channels: data,
    };

    statsCache.set(cacheKey, {
      expiresAt: Date.now() + statsCacheMs,
      payload,
    });
    sendJson(response, 200, payload);
  } catch (error) {
    const missingEnv = error.message === "missing_twitch_env";
    sendJson(response, missingEnv ? 200 : 500, {
      configured: false,
      message: missingEnv
        ? "Configure TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET no servidor."
        : `Erro ao consultar Twitch: ${error.message}`,
      channels: [],
    });
  }
}

async function handleSiteData(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, withSecurityHeaders({ Allow: "GET, HEAD" }));
    response.end("Method not allowed");
    return;
  }

  sendJson(response, 200, { ok: true, data: readSiteData() });
}

async function handleAdminSiteData(request, response) {
  if (!hasAdminAccess(request)) {
    sendJson(response, 401, { ok: false, message: "Token admin invalido ou ausente." });
    return;
  }

  if (request.method === "GET") {
    sendJson(response, 200, { ok: true, data: readSiteData() });
    return;
  }

  if (request.method !== "PUT") {
    response.writeHead(405, withSecurityHeaders({ Allow: "GET, PUT" }));
    response.end("Method not allowed");
    return;
  }

  try {
    const rawBody = await readRequestBody(request);
    const payload = sanitizeSiteData(JSON.parse(rawBody || "{}"));
    writeJsonFile(siteDataPath, payload);
    sendJson(response, 200, { ok: true, data: payload });
  } catch (error) {
    sendJson(response, 400, { ok: false, message: "Nao consegui salvar os dados enviados." });
  }
}

async function handleAnalytics(request, response) {
  if (request.method !== "POST") {
    response.writeHead(405, withSecurityHeaders({ Allow: "POST" }));
    response.end("Method not allowed");
    return;
  }

  try {
    const rawBody = await readRequestBody(request, 8_000);
    const event = JSON.parse(rawBody || "{}");
    const type = cleanText(event.type, 40) || "unknown";
    const channel = cleanLogin(event.channel);
    const analytics = readJsonFile(analyticsPath, { pageViews: 0, events: {}, channels: {} });

    analytics.pageViews = Number(analytics.pageViews || 0) + (type === "page_view" ? 1 : 0);
    analytics.events = analytics.events || {};
    analytics.channels = analytics.channels || {};
    analytics.events[type] = Number(analytics.events[type] || 0) + 1;

    if (channel) {
      analytics.channels[channel] = Number(analytics.channels[channel] || 0) + 1;
    }

    analytics.updatedAt = new Date().toISOString();
    writeJsonFile(analyticsPath, analytics);
    sendJson(response, 200, { ok: true });
  } catch {
    sendJson(response, 400, { ok: false });
  }
}

async function handleAdminAnalytics(request, response) {
  if (!hasAdminAccess(request)) {
    sendJson(response, 401, { ok: false, message: "Token admin invalido ou ausente." });
    return;
  }

  sendJson(response, 200, { ok: true, data: readJsonFile(analyticsPath, {}) });
}

function handleRobots(request, response) {
  const hostUrl = `https://${cleanHost(request.headers.host)}`;
  response.writeHead(200, withSecurityHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
  response.end(`User-agent: *\nAllow: /\nSitemap: ${hostUrl}/sitemap.xml\n`);
}

function handleSitemap(request, response) {
  const hostUrl = `https://${cleanHost(request.headers.host)}`;
  const siteData = readSiteData();
  const configuredStreamers = [
    "gaules",
    "alanzoka",
    "loud_coringa",
    "casimito",
    "cellbit",
    "baiano",
    ...siteData.streamers.map((streamer) => streamer.login),
  ];
  const uniqueStreamers = [...new Set(configuredStreamers.map(cleanLogin).filter(Boolean))].slice(0, 80);
  const urls = [
    `${hostUrl}/`,
    ...uniqueStreamers.map((login) => `${hostUrl}/streamer/${login}`),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((loc) => `  <url><loc>${loc}</loc><changefreq>hourly</changefreq></url>`)
    .join("\n")}\n</urlset>\n`;

  response.writeHead(200, withSecurityHeaders({ "Content-Type": "application/xml; charset=utf-8" }));
  response.end(xml);
}

function renderIndexWithSeo(request, response, streamerLogin = "") {
  const htmlPath = path.join(root, "index.html");

  fs.readFile(htmlPath, "utf8", (error, html) => {
    if (error) {
      response.writeHead(404, withSecurityHeaders());
      response.end("Not found");
      return;
    }

    const hostUrl = `https://${cleanHost(request.headers.host)}`;
    const login = cleanLogin(streamerLogin);
    const title = login ? `${login} ao vivo - Stream Brasil` : "Stream Brasil - Multi Stream BR";
    const description = login
      ? `Assista ${login} na Twitch com multi stream, chat, favoritos e emotes BTTV.`
      : "Hub brasileiro para assistir lives da Twitch com multi stream, chat, favoritos e emotes BTTV.";
    const canonical = login ? `${hostUrl}/streamer/${login}` : hostUrl;
    const meta = `
    <meta name="description" content="${description}">
    <link rel="canonical" href="${canonical}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${canonical}">
    <meta name="twitter:card" content="summary_large_image">
    <script>window.STREAM_BRASIL_INITIAL_CHANNEL=${JSON.stringify(login)};</script>`;

    const rendered = html
      .replace("<title>Stream Brasil - Multi Stream BR</title>", `<title>${title}</title>`)
      .replace("<!--SEO-->", meta);

    response.writeHead(200, withSecurityHeaders({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    }));
    response.end(request.method === "HEAD" ? undefined : rendered);
  });
}

function serveStatic(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, withSecurityHeaders({ Allow: "GET, HEAD" }));
    response.end("Method not allowed");
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(root, pathname === "/" ? "index.html" : pathname));
  const insideRoot = filePath === root || filePath.startsWith(`${root}${path.sep}`);
  const basename = path.basename(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const isRootPublicFile = path.dirname(filePath) === root && publicFiles.has(basename);
  const isAssetFile = filePath.startsWith(`${assetsRoot}${path.sep}`) && publicExtensions.has(extension);

  if (!insideRoot || basename.startsWith(".") || (!isRootPublicFile && !isAssetFile)) {
    response.writeHead(403, withSecurityHeaders());
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, withSecurityHeaders());
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      ...withSecurityHeaders({
        "Content-Type": types[extension] || "application/octet-stream",
        "Cache-Control": extension === ".html" ? "no-store" : "public, max-age=3600",
      }),
    });
    response.end(request.method === "HEAD" ? undefined : content);
  });
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    renderIndexWithSeo(request, response);
    return;
  }

  const streamerMatch = url.pathname.match(/^\/streamer\/([a-zA-Z0-9_]{3,25})\/?$/);
  if (request.method === "GET" && streamerMatch) {
    renderIndexWithSeo(request, response, streamerMatch[1]);
    return;
  }

  if (url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (url.pathname === "/robots.txt") {
    handleRobots(request, response);
    return;
  }

  if (url.pathname === "/sitemap.xml") {
    handleSitemap(request, response);
    return;
  }

  if (url.pathname === "/api/site-data") {
    handleSiteData(request, response);
    return;
  }

  if (url.pathname === "/api/admin/site-data") {
    handleAdminSiteData(request, response);
    return;
  }

  if (url.pathname === "/api/analytics") {
    handleAnalytics(request, response);
    return;
  }

  if (url.pathname === "/api/admin/analytics") {
    handleAdminAnalytics(request, response);
    return;
  }

  if (url.pathname === "/ads.txt") {
    const publisherId = process.env.ADSENSE_PUBLISHER_ID || "";

    if (!/^pub-\d+$/.test(publisherId)) {
      response.writeHead(404, withSecurityHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
      response.end("ads.txt not configured");
      return;
    }

    response.writeHead(200, withSecurityHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
    response.end(`google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`);
    return;
  }

  if (url.pathname === "/api/twitch/stats") {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, withSecurityHeaders({ Allow: "GET, HEAD" }));
      response.end("Method not allowed");
      return;
    }

    handleTwitchStats(request, response);
    return;
  }

  serveStatic(request, response);
});

server.listen(port, host, () => {
  console.log(`Stream Brasil aberto em http://${host}:${port}`);
});
