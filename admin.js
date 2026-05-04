const els = {
  tokenForm: document.querySelector("#tokenForm"),
  tokenInput: document.querySelector("#tokenInput"),
  siteDataForm: document.querySelector("#siteDataForm"),
  supportLinkInput: document.querySelector("#supportLinkInput"),
  sponsorTextInput: document.querySelector("#sponsorTextInput"),
  streamersInput: document.querySelector("#streamersInput"),
  presetsInput: document.querySelector("#presetsInput"),
  adminMessage: document.querySelector("#adminMessage"),
  analyticsOutput: document.querySelector("#analyticsOutput"),
};

let adminToken = localStorage.getItem("streamBrasilAdminToken") || "";
els.tokenInput.value = adminToken;

function setMessage(message, isError = false) {
  els.adminMessage.textContent = message;
  els.adminMessage.style.color = isError ? "var(--red)" : "var(--muted)";
}

async function adminFetch(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
      ...(options.headers || {}),
    },
  });
  const payload = await response.json();

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.message || "Falha no admin.");
  }

  return payload;
}

function parseStreamers(value) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [login, name, category] = line.split("|").map((part) => part?.trim());
      return { login, name: name || login, category: category || "Twitch", custom: true };
    });
}

function parsePresets(value) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, channels] = line.split(":");
      return {
        name: name?.trim() || "Preset",
        channels: String(channels || "")
          .split(",")
          .map((channel) => channel.trim().toLowerCase())
          .filter(Boolean),
      };
    });
}

function renderSiteData(data) {
  els.supportLinkInput.value = data.supportLink || "";
  els.sponsorTextInput.value = data.sponsorText || "";
  els.streamersInput.value = (data.streamers || [])
    .map((streamer) => `${streamer.login}|${streamer.name}|${streamer.category}`)
    .join("\n");
  els.presetsInput.value = (data.featuredPresets || [])
    .map((preset) => `${preset.name}: ${(preset.channels || []).join(",")}`)
    .join("\n");
}

async function loadAdmin() {
  const [siteData, analytics] = await Promise.all([
    adminFetch("/api/admin/site-data"),
    adminFetch("/api/admin/analytics"),
  ]);

  renderSiteData(siteData.data);
  els.analyticsOutput.textContent = JSON.stringify(analytics.data, null, 2);
  setMessage("Admin carregado.");
}

els.tokenForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminToken = els.tokenInput.value.trim();
  localStorage.setItem("streamBrasilAdminToken", adminToken);

  try {
    await loadAdmin();
  } catch (error) {
    setMessage(error.message, true);
  }
});

els.siteDataForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const payload = {
      supportLink: els.supportLinkInput.value.trim(),
      sponsorText: els.sponsorTextInput.value.trim(),
      streamers: parseStreamers(els.streamersInput.value),
      featuredPresets: parsePresets(els.presetsInput.value),
    };
    const saved = await adminFetch("/api/admin/site-data", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    renderSiteData(saved.data);
    setMessage("Configuracao salva.");
  } catch (error) {
    setMessage(error.message, true);
  }
});

if (adminToken) {
  loadAdmin().catch((error) => setMessage(error.message, true));
}
