const config = window.STREAM_BRASIL_CONFIG || {};
const baseStreamers = config.streamers || [
  { login: "gaules", name: "Gaules", category: "Counter-Strike 2" },
  { login: "alanzoka", name: "Alanzoka", category: "Variedades" },
  { login: "loud_coringa", name: "LOUD Coringa", category: "Just Chatting" },
  { login: "casimito", name: "Casimito", category: "Futebol e reacts" },
  { login: "cellbit", name: "Cellbit", category: "RPG e variedades" },
  { login: "baiano", name: "Baiano", category: "League of Legends" },
];

const storageKeys = {
  customStreamers: "streamBrasilCustomStreamers",
  favorites: "streamBrasilFavorites",
};

const els = {
  brandMark: document.querySelector("#brandMark"),
  brandName: document.querySelector("#brandName"),
  heroTitle: document.querySelector("#heroTitle"),
  heroSubtitle: document.querySelector("#heroSubtitle"),
  streamerGrid: document.querySelector("#streamerGrid"),
  favoritesStrip: document.querySelector("#favoritesStrip"),
  addStreamerForm: document.querySelector("#addStreamerForm"),
  newStreamerInput: document.querySelector("#newStreamerInput"),
  channelForm: document.querySelector("#channelForm"),
  channelInput: document.querySelector("#channelInput"),
  playerFrame: document.querySelector("#playerFrame"),
  chatFrame: document.querySelector("#chatFrame"),
  liveTitle: document.querySelector("#liveTitle"),
  heroChannel: document.querySelector("#heroChannel"),
  heroStatus: document.querySelector("#heroStatus"),
  favoriteCountLabel: document.querySelector("#favoriteCountLabel"),
  statusMetric: document.querySelector("#statusMetric"),
  statusDetail: document.querySelector("#statusDetail"),
  viewersMetric: document.querySelector("#viewersMetric"),
  viewersDetail: document.querySelector("#viewersDetail"),
  followersMetric: document.querySelector("#followersMetric"),
  followersDetail: document.querySelector("#followersDetail"),
  gameMetric: document.querySelector("#gameMetric"),
  gameDetail: document.querySelector("#gameDetail"),
  multiSelector: document.querySelector("#multiSelector"),
  multiPlayerGrid: document.querySelector("#multiPlayerGrid"),
  multiChatGrid: document.querySelector("#multiChatGrid"),
  multiPlayerHint: document.querySelector("#multiPlayerHint"),
  multiCountLabel: document.querySelector("#multiCountLabel"),
  emoteGrid: document.querySelector("#emoteGrid"),
  emoteCountLabel: document.querySelector("#emoteCountLabel"),
  emoteSearchInput: document.querySelector("#emoteSearchInput"),
  moneyGrid: document.querySelector("#moneyGrid"),
  supportLink: document.querySelector("#supportLink"),
  apiMessage: document.querySelector("#apiMessage"),
  homeApiLabel: document.querySelector("#homeApiLabel"),
};

const nf = new Intl.NumberFormat("pt-BR");
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
let customStreamers = readJson(storageKeys.customStreamers, []);
let favorites = readJson(storageKeys.favorites, []);
let streamers = mergeStreamers(baseStreamers, customStreamers);
let activeChannel = streamers[0]?.login || "gaules";
let apiConfigured = false;
let statsByLogin = new Map();
let multiLimit = 4;
let selectedMulti = streamers.slice(0, 4).map((streamer) => streamer.login);
let activeEmoteTab = "channel";
let emoteSearch = "";
let emoteCache = {
  global: [],
  channel: new Map(),
};

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value || ""), window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
  } catch {
    return "#";
  }
}

function normalizeLogin(login) {
  return String(login || "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "");
}

function isValidLogin(login) {
  return /^[a-z0-9_]{3,25}$/.test(login);
}

function mergeStreamers(defaults, custom) {
  const map = new Map();

  [...defaults, ...custom].forEach((streamer) => {
    const login = normalizeLogin(streamer.login);
    if (!isValidLogin(login)) return;
    map.set(login, {
      login,
      name: streamer.name || login,
      category: streamer.category || "Twitch",
      custom: Boolean(streamer.custom),
    });
  });

  return [...map.values()];
}

function getParentHost() {
  if (window.location.protocol === "file:") return "";
  return window.location.hostname || "localhost";
}

function setApiMessage(message, isError = false) {
  els.apiMessage.textContent = message;
  els.apiMessage.style.color = isError ? "var(--red)" : "var(--muted)";
}

function openTab(tabName) {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === tabName);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getStreamer(login) {
  return streamers.find((streamer) => streamer.login === login);
}

function getStreamerLabel(login) {
  return getStreamer(login)?.name || statsByLogin.get(login)?.displayName || login;
}

function setBrandContent() {
  document.title = `${config.brandName || "Stream Brasil"} - Multi Stream BR`;
  els.brandMark.textContent = config.brandMark || "SB";
  els.brandName.textContent = config.brandName || "Stream Brasil";
  els.heroTitle.textContent = config.heroTitle || "Multi Stream BR";
  els.heroSubtitle.textContent = config.heroSubtitle || "Assista varios streamers brasileiros ao mesmo tempo.";

  if (config.supportLink && config.supportLink !== "https://buy.stripe.com/") {
    els.supportLink.href = safeExternalUrl(config.supportLink);
    els.supportLink.textContent = "Apoiar projeto";
  } else {
    els.supportLink.href = "#";
    els.supportLink.textContent = "Adicionar link de apoio";
  }
}

function renderAdsense() {
  const adsense = config.adsense || {};
  const client = adsense.client || "";
  const slots = adsense.slots || {};
  const enabled = Boolean(adsense.enabled && /^ca-pub-\d+$/.test(client));

  if (!enabled) return;

  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.append(script);

  document.querySelectorAll("[data-ad-slot-name]").forEach((container) => {
    const slot = slots[container.dataset.adSlotName];
    if (!/^\d+$/.test(String(slot || ""))) return;

    container.classList.add("active");
    container.innerHTML = `
      <ins class="adsbygoogle"
        style="display:block"
        data-ad-client="${escapeHtml(client)}"
        data-ad-slot="${escapeHtml(slot)}"
        data-ad-format="auto"
        data-full-width-responsive="true"></ins>
    `;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense may block in local/dev environments.
    }
  });
}

function renderFavorites() {
  const favoriteStreamers = favorites.map(getStreamer).filter(Boolean);
  els.favoriteCountLabel.textContent = String(favoriteStreamers.length);

  if (!favoriteStreamers.length) {
    els.favoritesStrip.innerHTML = `<span class="emote-note">Clique em Favoritar nos cards para montar sua lista.</span>`;
    return;
  }

  els.favoritesStrip.innerHTML = favoriteStreamers
    .map((streamer) => `<button class="favorite-chip" type="button" data-favorite-watch="${escapeHtml(streamer.login)}">${escapeHtml(streamer.name)}</button>`)
    .join("");

  els.favoritesStrip.querySelectorAll("[data-favorite-watch]").forEach((button) => {
    button.addEventListener("click", () => loadChannel(button.dataset.favoriteWatch));
  });
}

function renderStreamers() {
  els.streamerGrid.innerHTML = streamers
    .map((streamer) => {
      const stats = statsByLogin.get(streamer.login);
      const isFavorite = favorites.includes(streamer.login);
      const liveText = stats?.isLive ? `${compact.format(stats.viewerCount)} viewers agora` : "Offline ou aguardando API";
      const followerText = stats?.followerTotal != null
        ? `${compact.format(stats.followerTotal)} seguidores`
        : "Seguidores via API";
      const selected = selectedMulti.includes(streamer.login);

      return `
        <article class="streamer-card ${streamer.login === activeChannel ? "active" : ""} ${isFavorite ? "favorite" : ""}">
          <div>
            <p>${streamer.custom ? "Adicionado por voce" : "Twitch / Brasil"}</p>
            <strong>${escapeHtml(streamer.name)}</strong>
            <p>${escapeHtml(stats?.gameName || streamer.category)}</p>
          </div>
          <div>
            <p>${escapeHtml(liveText)}</p>
            <p>${escapeHtml(followerText)}</p>
          </div>
          <div class="card-actions">
            <button type="button" data-watch="${escapeHtml(streamer.login)}">Assistir</button>
            <button class="${selected ? "selected" : ""}" type="button" data-multi="${escapeHtml(streamer.login)}">
              ${selected ? "No multi" : "Multi"}
            </button>
            <button class="${isFavorite ? "selected" : ""}" type="button" data-favorite="${escapeHtml(streamer.login)}">
              ${isFavorite ? "Favorito" : "Favoritar"}
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  els.streamerGrid.querySelectorAll("[data-watch]").forEach((button) => {
    button.addEventListener("click", () => loadChannel(button.dataset.watch));
  });

  els.streamerGrid.querySelectorAll("[data-multi]").forEach((button) => {
    button.addEventListener("click", () => toggleMultiChannel(button.dataset.multi));
  });

  els.streamerGrid.querySelectorAll("[data-favorite]").forEach((button) => {
    button.addEventListener("click", () => toggleFavorite(button.dataset.favorite));
  });

  renderFavorites();
}

function toggleFavorite(channel) {
  if (favorites.includes(channel)) {
    favorites = favorites.filter((login) => login !== channel);
  } else {
    favorites = [channel, ...favorites];
  }

  writeJson(storageKeys.favorites, favorites);
  renderStreamers();
}

function addCustomStreamer(login) {
  const normalized = normalizeLogin(login);

  if (!isValidLogin(normalized)) {
    setApiMessage("Digite um login da Twitch valido, com 3 a 25 caracteres.", true);
    return;
  }

  if (!streamers.some((streamer) => streamer.login === normalized)) {
    customStreamers = [{ login: normalized, name: normalized, category: "Twitch", custom: true }, ...customStreamers];
    writeJson(storageKeys.customStreamers, customStreamers);
    streamers = mergeStreamers(baseStreamers, customStreamers);
  }

  if (!selectedMulti.includes(normalized)) {
    selectedMulti = [normalized, ...selectedMulti].slice(0, 4);
  }

  loadChannel(normalized);
  fetchAllStats();
}

function renderMultiSelector() {
  els.multiSelector.innerHTML = streamers
    .map((streamer) => `
      <button class="${selectedMulti.includes(streamer.login) ? "active" : ""}" type="button" data-channel="${escapeHtml(streamer.login)}">
        ${escapeHtml(streamer.name)}
      </button>
    `)
    .join("");

  els.multiSelector.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => toggleMultiChannel(button.dataset.channel));
  });
}

function buildPlayerSrc(channel) {
  const parent = getParentHost();
  if (!parent) return "";
  return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${encodeURIComponent(parent)}&muted=true`;
}

function buildChatSrc(channel) {
  const parent = getParentHost();
  if (!parent) return "";
  return `https://www.twitch.tv/embed/${encodeURIComponent(channel)}/chat?parent=${encodeURIComponent(parent)}&darkpopout`;
}

function renderEmbeds(channel) {
  const parent = getParentHost();

  els.heroChannel.textContent = getStreamerLabel(channel);
  els.liveTitle.textContent = `${getStreamerLabel(channel)} na Twitch`;
  els.channelInput.value = channel;

  if (!parent) {
    els.statusMetric.textContent = "Servidor";
    els.statusDetail.textContent = "Abra pelo site publicado ou servidor local";
    els.heroStatus.textContent = "Abra por http://localhost ou pelo dominio hospedado";
    els.playerFrame.removeAttribute("src");
    els.chatFrame.removeAttribute("src");
    return;
  }

  els.playerFrame.src = buildPlayerSrc(channel);
  els.chatFrame.src = buildChatSrc(channel);
  els.statusMetric.textContent = "Online";
  els.statusDetail.textContent = `Embed liberado para ${parent}`;
}

function renderMultiEmbeds() {
  const channels = selectedMulti.slice(0, multiLimit);
  const layoutClass = multiLimit === 2 ? "two" : multiLimit === 3 ? "three" : "four";

  els.multiPlayerGrid.className = `multi-player-grid ${layoutClass}`;
  els.multiPlayerHint.textContent = `${channels.length} lives carregadas`;
  els.multiCountLabel.textContent = String(channels.length);

  els.multiPlayerGrid.innerHTML = channels
    .map((channel) => `
      <article class="multi-frame">
        <div class="mini-title">
          <strong>${escapeHtml(getStreamerLabel(channel))}</strong>
          <span>${statsByLogin.get(channel)?.isLive ? "Ao vivo" : "Twitch"}</span>
        </div>
        <iframe title="Player ${escapeHtml(getStreamerLabel(channel))}" src="${escapeHtml(buildPlayerSrc(channel))}" allowfullscreen></iframe>
      </article>
    `)
    .join("");

  els.multiChatGrid.innerHTML = channels
    .map((channel) => `
      <article class="chat-frame">
        <div class="mini-title">
          <strong>${escapeHtml(getStreamerLabel(channel))}</strong>
          <span>Chat</span>
        </div>
        <iframe
          title="Chat ${escapeHtml(getStreamerLabel(channel))}"
          src="${escapeHtml(buildChatSrc(channel))}"
          sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-modals">
        </iframe>
      </article>
    `)
    .join("");
}

function toggleMultiChannel(channel) {
  if (selectedMulti.includes(channel)) {
    selectedMulti = selectedMulti.filter((login) => login !== channel);
  } else {
    selectedMulti = [channel, ...selectedMulti].slice(0, 4);
  }

  if (!selectedMulti.length) {
    selectedMulti = [channel];
  }

  renderStreamers();
  renderMultiSelector();
  renderMultiEmbeds();
}

function renderSelectedStats(channel) {
  const stats = statsByLogin.get(channel);

    if (!apiConfigured) {
    els.viewersMetric.textContent = "API";
    els.viewersDetail.textContent = "Configure as variaveis no servidor";
    els.followersMetric.textContent = "API";
    els.followersDetail.textContent = "Configure Twitch no deploy";
    els.gameMetric.textContent = "Twitch";
    els.gameDetail.textContent = "Player e chat ja funcionam";
    els.heroStatus.textContent = "Falta configurar API no servidor";
    els.homeApiLabel.textContent = "Offline";
    return;
  }

  if (!stats) {
    els.viewersMetric.textContent = "Canal";
    els.viewersDetail.textContent = "Nao achei esse login na Twitch API";
    els.followersMetric.textContent = "Canal";
    els.followersDetail.textContent = "Confira o nome digitado";
    els.gameMetric.textContent = "Twitch";
    els.gameDetail.textContent = "Sem dados para este canal";
    els.heroStatus.textContent = "Canal nao encontrado";
    els.homeApiLabel.textContent = "Twitch";
    return;
  }

  if (stats.isLive) {
    els.viewersMetric.textContent = nf.format(stats.viewerCount);
    els.viewersDetail.textContent = stats.title || "Live ao vivo";
    els.gameMetric.textContent = stats.gameName || "Ao vivo";
    els.gameDetail.textContent = "Categoria oficial";
    els.liveTitle.textContent = stats.title || `${stats.displayName} na Twitch`;
    els.heroStatus.textContent = `${compact.format(stats.viewerCount)} viewers agora`;
    els.homeApiLabel.textContent = "Online";
  } else {
    els.viewersMetric.textContent = "Offline";
    els.viewersDetail.textContent = "Canal nao esta ao vivo agora";
    els.gameMetric.textContent = stats.gameName || "Offline";
    els.gameDetail.textContent = "Ultima categoria conhecida";
    els.heroStatus.textContent = "Canal offline, chat continua disponivel";
    els.homeApiLabel.textContent = "Online";
  }

  if (stats.followerTotal != null) {
    els.followersMetric.textContent = nf.format(stats.followerTotal);
    els.followersDetail.textContent = stats.followersNote || "Total oficial da Twitch";
  } else {
    els.followersMetric.textContent = "Sem acesso";
    els.followersDetail.textContent = stats.followersNote || "Use um user access token se necessario";
  }
}

function normalizeBttvEmotes(rawEmotes, source) {
  return rawEmotes
    .filter((emote) => emote?.id && emote?.code)
    .map((emote) => ({
      id: emote.id,
      code: emote.code,
      source,
      animated: Boolean(emote.animated || emote.imageType === "gif"),
      imageUrl: `https://cdn.betterttv.net/emote/${emote.id}/3x`,
    }));
}

async function fetchBttvGlobal() {
  if (emoteCache.global.length) return emoteCache.global;
  const response = await fetch("https://api.betterttv.net/3/cached/emotes/global");
  if (!response.ok) throw new Error("bttv_global");
  const payload = await response.json();
  emoteCache.global = normalizeBttvEmotes(payload, "Global");
  return emoteCache.global;
}

async function fetchBttvChannel(channel) {
  if (emoteCache.channel.has(channel)) return emoteCache.channel.get(channel);
  const stats = statsByLogin.get(channel);

  if (!stats?.id) {
    emoteCache.channel.set(channel, []);
    return [];
  }

  const response = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${encodeURIComponent(stats.id)}`);

  if (!response.ok) {
    emoteCache.channel.set(channel, []);
    return [];
  }

  const payload = await response.json();
  const channelEmotes = normalizeBttvEmotes(payload.channelEmotes || [], "Canal");
  const sharedEmotes = normalizeBttvEmotes(payload.sharedEmotes || [], "Compartilhado");
  const emotes = [...channelEmotes, ...sharedEmotes];
  emoteCache.channel.set(channel, emotes);
  return emotes;
}

async function renderEmotes() {
  els.emoteGrid.innerHTML = `<article class="emote-card"><strong>Carregando BTTV...</strong></article>`;

  try {
    const emotes = activeEmoteTab === "global"
      ? await fetchBttvGlobal()
      : await fetchBttvChannel(activeChannel);
    const filtered = emotes
      .filter((emote) => emote.code.toLowerCase().includes(emoteSearch.toLowerCase()))
      .slice(0, 72);

    els.emoteCountLabel.textContent = String(emotes.length);

    if (!filtered.length) {
      els.emoteGrid.innerHTML = `<article class="emote-card"><strong>Nenhum emote encontrado</strong></article>`;
      return;
    }

    els.emoteGrid.innerHTML = filtered
      .map((emote) => `
        <article class="emote-card" title="${escapeHtml(emote.source)}">
          <img src="${escapeHtml(emote.imageUrl)}" alt="${escapeHtml(emote.code)}" loading="lazy" />
          <strong>${escapeHtml(emote.code)}</strong>
        </article>
      `)
      .join("");
  } catch (error) {
    els.emoteCountLabel.textContent = "0";
    els.emoteGrid.innerHTML = `<article class="emote-card"><strong>Nao consegui carregar BTTV</strong></article>`;
  }
}

function renderMoneyCards() {
  const cards = config.monetizationCards || [];

  els.moneyGrid.innerHTML = cards
    .map((card) => `
      <article class="money-card">
        <strong>${escapeHtml(card.title)}</strong>
        <p>${escapeHtml(card.text)}</p>
      </article>
    `)
    .join("");
}

async function fetchAllStats() {
  const channels = streamers.map((streamer) => streamer.login).join(",");

  try {
    const response = await fetch(`/api/twitch/stats?channels=${encodeURIComponent(channels)}`);
    const payload = await response.json();

    apiConfigured = Boolean(payload.configured);
    statsByLogin = new Map((payload.channels || []).map((channel) => [channel.login.toLowerCase(), channel]));
    renderStreamers();
    renderSelectedStats(activeChannel);
    renderMultiEmbeds();
    renderEmotes();

    if (payload.configured) {
      const updatedAt = payload.generatedAt ? new Date(payload.generatedAt).toLocaleTimeString("pt-BR") : "agora";
      setApiMessage(`API conectada. Dados atualizados as ${updatedAt}.`);
    } else {
      setApiMessage(payload.message || "Configure TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET no servidor.", true);
    }
  } catch (error) {
    apiConfigured = false;
    renderSelectedStats(activeChannel);
    setApiMessage(`Nao consegui chamar o backend: ${error.message}`, true);
  }
}

function loadChannel(channel) {
  activeChannel = normalizeLogin(channel) || activeChannel;
  renderStreamers();
  renderEmbeds(activeChannel);
  renderSelectedStats(activeChannel);
  renderEmotes();
}

els.channelForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadChannel(els.channelInput.value);
});

els.addStreamerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addCustomStreamer(els.newStreamerInput.value);
  els.newStreamerInput.value = "";
});

els.emoteSearchInput.addEventListener("input", () => {
  emoteSearch = els.emoteSearchInput.value.trim();
  renderEmotes();
});

document.querySelectorAll("[data-layout]").forEach((button) => {
  button.addEventListener("click", () => {
    multiLimit = Number(button.dataset.layout);
    document.querySelectorAll("[data-layout]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderMultiEmbeds();
  });
});

document.querySelectorAll("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => openTab(button.dataset.tab));
});

document.querySelectorAll("[data-open-tab]").forEach((button) => {
  button.addEventListener("click", () => openTab(button.dataset.openTab));
});

document.querySelectorAll("[data-emote-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    activeEmoteTab = button.dataset.emoteTab;
    document.querySelectorAll("[data-emote-tab]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderEmotes();
  });
});

setBrandContent();
renderAdsense();
renderMoneyCards();
renderStreamers();
renderMultiSelector();
loadChannel(activeChannel);
renderMultiEmbeds();
fetchAllStats();
setInterval(fetchAllStats, 60_000);
