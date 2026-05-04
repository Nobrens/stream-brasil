const streamers = [
  { login: "gaules", name: "Gaules", category: "Counter-Strike 2" },
  { login: "alanzoka", name: "Alanzoka", category: "Variedades" },
  { login: "loud_coringa", name: "LOUD Coringa", category: "Just Chatting" },
  { login: "casimito", name: "Casimito", category: "Futebol e reacts" },
  { login: "cellbit", name: "Cellbit", category: "RPG e variedades" },
  { login: "baiano", name: "Baiano", category: "League of Legends" },
];

const els = {
  streamerGrid: document.querySelector("#streamerGrid"),
  channelForm: document.querySelector("#channelForm"),
  channelInput: document.querySelector("#channelInput"),
  playerFrame: document.querySelector("#playerFrame"),
  chatFrame: document.querySelector("#chatFrame"),
  liveTitle: document.querySelector("#liveTitle"),
  heroChannel: document.querySelector("#heroChannel"),
  heroStatus: document.querySelector("#heroStatus"),
  statusMetric: document.querySelector("#statusMetric"),
  statusDetail: document.querySelector("#statusDetail"),
  viewersMetric: document.querySelector("#viewersMetric"),
  viewersDetail: document.querySelector("#viewersDetail"),
  followersMetric: document.querySelector("#followersMetric"),
  followersDetail: document.querySelector("#followersDetail"),
  gameMetric: document.querySelector("#gameMetric"),
  gameDetail: document.querySelector("#gameDetail"),
  apiMessage: document.querySelector("#apiMessage"),
  openSettingsButton: document.querySelector("#openSettingsButton"),
};

const nf = new Intl.NumberFormat("pt-BR");
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
let activeChannel = "gaules";
let apiConfigured = false;
let statsByLogin = new Map();

function getParentHost() {
  if (window.location.protocol === "file:") return "";
  return window.location.hostname || "localhost";
}

function setApiMessage(message, isError = false) {
  els.apiMessage.textContent = message;
  els.apiMessage.style.color = isError ? "var(--red)" : "var(--muted)";
}

function getStreamerLabel(login) {
  return streamers.find((streamer) => streamer.login === login)?.name || login;
}

function renderStreamers() {
  els.streamerGrid.innerHTML = streamers
    .map((streamer) => {
      const stats = statsByLogin.get(streamer.login);
      const liveText = stats?.isLive ? `${compact.format(stats.viewerCount)} viewers agora` : "Offline ou aguardando API";
      const followerText = stats?.followerTotal != null
        ? `${compact.format(stats.followerTotal)} seguidores`
        : "Seguidores via API";

      return `
        <article class="streamer-card ${streamer.login === activeChannel ? "active" : ""}">
          <div>
            <p>Twitch / Brasil</p>
            <strong>${streamer.name}</strong>
            <p>${stats?.gameName || streamer.category}</p>
          </div>
          <div>
            <p>${liveText}</p>
            <p>${followerText}</p>
          </div>
          <button type="button" data-channel="${streamer.login}">Assistir</button>
        </article>
      `;
    })
    .join("");

  els.streamerGrid.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => loadChannel(button.dataset.channel));
  });
}

function renderEmbeds(channel) {
  const parent = getParentHost();

  els.heroChannel.textContent = getStreamerLabel(channel);
  els.liveTitle.textContent = `${getStreamerLabel(channel)} na Twitch`;
  els.channelInput.value = channel;

  if (!parent) {
    els.statusMetric.textContent = "Servidor";
    els.statusDetail.textContent = "Abra pelo servidor local ou pelo site publicado";
    els.heroStatus.textContent = "Abra por http://localhost ou pelo dominio hospedado";
    els.playerFrame.removeAttribute("src");
    els.chatFrame.removeAttribute("src");
    return;
  }

  const encodedChannel = encodeURIComponent(channel);
  const encodedParent = encodeURIComponent(parent);

  els.playerFrame.src = `https://player.twitch.tv/?channel=${encodedChannel}&parent=${encodedParent}&muted=true`;
  els.chatFrame.src = `https://www.twitch.tv/embed/${encodedChannel}/chat?parent=${encodedParent}&darkpopout`;
  els.statusMetric.textContent = "Online";
  els.statusDetail.textContent = `Embed liberado para ${parent}`;
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
    return;
  }

  if (stats.isLive) {
    els.viewersMetric.textContent = nf.format(stats.viewerCount);
    els.viewersDetail.textContent = stats.title || "Live ao vivo";
    els.gameMetric.textContent = stats.gameName || "Ao vivo";
    els.gameDetail.textContent = "Categoria oficial";
    els.liveTitle.textContent = stats.title || `${stats.displayName} na Twitch`;
    els.heroStatus.textContent = `${compact.format(stats.viewerCount)} viewers agora`;
  } else {
    els.viewersMetric.textContent = "Offline";
    els.viewersDetail.textContent = "Canal nao esta ao vivo agora";
    els.gameMetric.textContent = stats.gameName || "Offline";
    els.gameDetail.textContent = "Ultima categoria conhecida";
    els.heroStatus.textContent = "Canal offline, chat continua disponivel";
  }

  if (stats.followerTotal != null) {
    els.followersMetric.textContent = nf.format(stats.followerTotal);
    els.followersDetail.textContent = stats.followersNote || "Total oficial da Twitch";
  } else {
    els.followersMetric.textContent = "Sem acesso";
    els.followersDetail.textContent = stats.followersNote || "Use um user access token se necessario";
  }
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

    if (payload.configured) {
      const updatedAt = payload.generatedAt ? new Date(payload.generatedAt).toLocaleTimeString("pt-BR") : "agora";
      setApiMessage(`API conectada. Dados dos streamers atualizados as ${updatedAt}.`);
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
  activeChannel = channel.trim().toLowerCase() || "gaules";
  renderStreamers();
  renderEmbeds(activeChannel);
  renderSelectedStats(activeChannel);
}

els.channelForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadChannel(els.channelInput.value);
});

els.openSettingsButton.addEventListener("click", () => {
  document.querySelector("#api").scrollIntoView({ behavior: "smooth", block: "start" });
});

renderStreamers();
loadChannel(activeChannel);
fetchAllStats();
setInterval(fetchAllStats, 60_000);
