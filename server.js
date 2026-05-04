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
};

const publicExtensions = new Set([".html", ".css", ".js", ".png", ".jpg", ".jpeg", ".svg"]);
const publicFiles = new Set(["index.html", "styles.css", "app.js", "site-config.js"]);
const assetsRoot = path.join(root, "assets");
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

function sendJson(response, status, payload) {
  response.writeHead(status, {
    ...withSecurityHeaders({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    }),
  });
  response.end(JSON.stringify(payload));
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

  if (url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true });
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
