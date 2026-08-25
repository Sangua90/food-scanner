class FoodScannerPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._items = [];
    this._reviews = [];
    this._loading = false;
    this._busyReview = null;
    this._error = "";
    this._filters = { location: "", sort: "expiry", search: "" };
  }

  set hass(value) {
    const first = !this._hass;
    this._hass = value;
    if (first) this._load();
  }

  set panel(value) { this._panel = value; }
  connectedCallback() { this._render(); }

  _esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  _labelLocation(value) {
    return { frigo: "Frigo", freezer: "Freezer", dispensa: "Dispensa" }[value] || "Senza posizione";
  }

  _formatDate(value) {
    if (!value) return "Nessuna scadenza";
    const parts = String(value).split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
  }

  _expiryInfo(value) {
    if (!value) return { text: "Nessuna scadenza", cls: "neutral" };
    const d = new Date(`${value}T12:00:00`);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    const days = Math.round((d - today) / 86400000);
    if (days < 0) return { text: `Scaduto da ${Math.abs(days)} g`, cls: "danger" };
    if (days === 0) return { text: "Scade oggi", cls: "danger" };
    if (days === 1) return { text: "Scade domani", cls: "warning" };
    if (days <= 3) return { text: `Scade tra ${days} giorni`, cls: "warning" };
    return { text: `Scade tra ${days} giorni`, cls: "ok" };
  }

  async _load() {
    if (!this._hass || this._loading) return;
    this._loading = true;
    this._error = "";
    this._render();
    try {
      const q = new URLSearchParams();
      q.set("sort", this._filters.sort);
      if (this._filters.location) q.set("location", this._filters.location);
      if (this._filters.search) q.set("search", this._filters.search);
      const data = await this._hass.callApi("GET", `food_scanner/archive?${q.toString()}`);
      this._items = data.items || [];
      this._reviews = data.reviews || [];
      this._summary = data;
    } catch (err) {
      this._error = err?.message || String(err);
    } finally {
      this._loading = false;
      this._render();
    }
  }

  async _consume(id, amount) {
    try {
      await this._hass.callApi("POST", "food_scanner/archive", { action: "consume", id, amount });
      await this._load();
    } catch (err) { alert(err?.message || err); }
  }

  async _consumeCustom(id, max) {
    const value = prompt(`Quante unità vuoi togliere? Disponibili: ${max}`, "1");
    if (value === null) return;
    const amount = Number.parseInt(value, 10);
    if (!Number.isInteger(amount) || amount < 1) return alert("Quantità non valida");
    await this._consume(id, amount);
  }

  async _setStock(id, current) {
    const value = prompt("Imposta la quantità reale disponibile:", String(current));
    if (value === null) return;
    const amount = Number.parseInt(value, 10);
    if (!Number.isInteger(amount) || amount < 0) return alert("Quantità non valida");
    try {
      await this._hass.callApi("POST", "food_scanner/archive", { action: "set_stock", id, amount });
      await this._load();
    } catch (err) { alert(err?.message || err); }
  }

  async _deleteLot(id, name) {
    if (!confirm(`Eliminare completamente il lotto “${name}”?`)) return;
    try {
      await this._hass.callApi("DELETE", `food_scanner/archive?id=${encodeURIComponent(id)}`);
      await this._load();
    } catch (err) { alert(err?.message || err); }
  }

  _fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        resolve(result.includes(",") ? result.split(",", 2)[1] : result);
      };
      reader.onerror = () => reject(reader.error || new Error("Lettura foto fallita"));
      reader.readAsDataURL(file);
    });
  }

  async _retryReview(id, file) {
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) return alert("Foto troppo grande: massimo 12 MB");

    const mime = (file.type || "image/jpeg").toLowerCase();
    const supported = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    if (!supported.includes(mime)) {
      return alert("Formato non supportato. Usa JPEG, PNG, WEBP, HEIC o HEIF.");
    }

    this._busyReview = id;
    this._render();
    try {
      const image_data = await this._fileToBase64(file);
      const result = await this._hass.callApi("POST", "food_scanner/archive", {
        action: "retry_review",
        id,
        mime_type: mime,
        image_data,
      });
      if (result.status === "archived") alert("Prodotto verificato e salvato in magazzino.");
      else alert(result.photo_request || "Serve ancora una foto più chiara.");
      await this._load();
    } catch (err) {
      alert(err?.message || err);
    } finally {
      this._busyReview = null;
      this._render();
    }
  }

  async _confirmReview(id) {
    if (!confirm("Salvare comunque i dati letti? Potrai correggere la quantità dopo.")) return;
    this._busyReview = id;
    this._render();
    try {
      await this._hass.callApi("POST", "food_scanner/archive", { action: "confirm_review", id });
      await this._load();
    } catch (err) { alert(err?.message || err); }
    finally { this._busyReview = null; this._render(); }
  }

  async _discardReview(id) {
    if (!confirm("Scartare questa scansione?")) return;
    try {
      await this._hass.callApi("POST", "food_scanner/archive", { action: "discard_review", id });
      await this._load();
    } catch (err) { alert(err?.message || err); }
  }

  _bind() {
    const root = this.shadowRoot;
    const location = root.querySelector("#location");
    const sort = root.querySelector("#sort");
    const search = root.querySelector("#search");
    const refresh = root.querySelector("#refresh");

    if (location) location.onchange = () => { this._filters.location = location.value; this._load(); };
    if (sort) sort.onchange = () => { this._filters.sort = sort.value; this._load(); };
    if (search) search.oninput = () => {
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => { this._filters.search = search.value.trim(); this._load(); }, 300);
    };
    if (refresh) refresh.onclick = () => this._load();

    root.querySelectorAll("[data-action='minus1']").forEach(btn => btn.onclick = () => this._consume(btn.dataset.id, 1));
    root.querySelectorAll("[data-action='minus2']").forEach(btn => btn.onclick = () => this._consume(btn.dataset.id, 2));
    root.querySelectorAll("[data-action='consume']").forEach(btn => btn.onclick = () => this._consumeCustom(btn.dataset.id, Number(btn.dataset.max)));
    root.querySelectorAll("[data-action='set']").forEach(btn => btn.onclick = () => this._setStock(btn.dataset.id, Number(btn.dataset.current)));
    root.querySelectorAll("[data-action='delete']").forEach(btn => btn.onclick = () => this._deleteLot(btn.dataset.id, btn.dataset.name));

    root.querySelectorAll("[data-action='retry']").forEach(btn => btn.onclick = () => {
      root.querySelector(`#photo-${btn.dataset.id}`)?.click();
    });
    root.querySelectorAll("input[data-review-photo]").forEach(input => input.onchange = () => {
      const file = input.files?.[0];
      if (file) this._retryReview(input.dataset.id, file);
      input.value = "";
    });
    root.querySelectorAll("[data-action='confirm-review']").forEach(btn => btn.onclick = () => this._confirmReview(btn.dataset.id));
    root.querySelectorAll("[data-action='discard-review']").forEach(btn => btn.onclick = () => this._discardReview(btn.dataset.id));
  }

  _renderReview(review) {
    const food = review.food || {};
    const id = this._esc(review.id);
    const name = food.product_name || "Prodotto non identificato";
    const missing = Array.isArray(food.missing_fields) && food.missing_fields.length
      ? food.missing_fields.join(", ") : "dati insufficienti";
    const request = food.photo_request || "Scatta una foto più chiara del prodotto e della scadenza.";
    const busy = this._busyReview === review.id;
    return `
      <article class="item reviewCard">
        <div class="top">
          <div>
            <h3>📸 ${this._esc(name)}</h3>
            <div class="meta">
              ${food.brand ? `<span class="brand">${this._esc(food.brand)}</span>` : ""}
              ${food.quantity ? `<span>${this._esc(food.quantity)}</span>` : ""}
              <span>Confidenza ${this._esc(food.confidence ?? 0)}%</span>
            </div>
          </div>
          <span class="place">${this._esc(this._labelLocation(review.location))}</span>
        </div>
        <div class="reviewRequest">${this._esc(request)}</div>
        <div class="details">Manca/è incerto: ${this._esc(missing)} · Tentativi: ${this._esc(review.attempts || 1)}</div>
        <div class="actions">
          <input id="photo-${id}" data-review-photo data-id="${id}" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" hidden>
          <button ${busy ? "disabled" : ""} data-action="retry" data-id="${id}">${busy ? "Analisi…" : "Fotografa di nuovo"}</button>
          <button class="secondary" ${busy ? "disabled" : ""} data-action="confirm-review" data-id="${id}">Salva comunque</button>
          <button class="dangerBtn" ${busy ? "disabled" : ""} data-action="discard-review" data-id="${id}">Scarta</button>
        </div>
      </article>`;
  }

  _renderItem(item) {
    const expiry = this._expiryInfo(item.expiry_date);
    const stock = Number(item.stock_units || 1);
    const unitName = item.unit_name || "unità";
    const perPack = Number(item.units_per_package || 1);
    const packageText = perPack > 1
      ? `${item.package_type || "confezione"}: ${perPack} ${unitName}`
      : (item.package_type || "confezione");
    const minus2Disabled = stock < 2 ? "disabled" : "";
    return `
      <article class="item">
        <div class="top">
          <div>
            <h3>${this._esc(item.product_name || "Prodotto")}</h3>
            <div class="meta">
              ${item.brand ? `<span class="brand">${this._esc(item.brand)}</span>` : ""}
              ${item.quantity ? `<span>${this._esc(item.quantity)}</span>` : ""}
              ${item.barcode ? `<span>EAN ${this._esc(item.barcode)}</span>` : ""}
            </div>
          </div>
          <span class="place">${this._esc(this._labelLocation(item.location))}</span>
        </div>
        <div class="middle">
          <div class="stock"><strong>${stock}</strong><span>${this._esc(unitName)}</span></div>
          <div class="details">
            <div>${this._esc(packageText)}</div>
            <div>${this._esc(this._formatDate(item.expiry_date))} · <span class="expiry ${expiry.cls}">${this._esc(expiry.text)}</span></div>
            <div>${item.expiry_type ? this._esc(item.expiry_type) : ""}</div>
          </div>
        </div>
        <div class="actions">
          <button data-action="minus1" data-id="${this._esc(item.id)}">−1</button>
          <button ${minus2Disabled} data-action="minus2" data-id="${this._esc(item.id)}">−2</button>
          <button data-action="consume" data-id="${this._esc(item.id)}" data-max="${stock}">Consuma…</button>
          <button class="secondary" data-action="set" data-id="${this._esc(item.id)}" data-current="${stock}">Correggi quantità</button>
          <button class="dangerBtn" data-action="delete" data-id="${this._esc(item.id)}" data-name="${this._esc(item.product_name || "Prodotto")}">Elimina lotto</button>
        </div>
      </article>`;
  }

  _render() {
    if (!this.shadowRoot) return;
    const items = this._items || [];
    const reviews = this._reviews || [];
    const totalUnits = items.reduce((sum, x) => sum + Number(x.stock_units || 1), 0);
    const cards = items.map(item => this._renderItem(item)).join("");
    const reviewCards = reviews.map(item => this._renderReview(item)).join("");

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; min-height:100%; background:var(--primary-background-color); color:var(--primary-text-color); font-family:var(--paper-font-body1_-_font-family, sans-serif); }
        .wrap { max-width:1200px; margin:0 auto; padding:20px; }
        header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; }
        h1 { margin:0; font-size:28px; } h2 { margin:24px 0 12px; font-size:21px; }
        .sub { color:var(--secondary-text-color); margin-top:4px; }
        .summary { display:flex; gap:10px; flex-wrap:wrap; margin:14px 0 18px; }
        .pill { background:var(--card-background-color); border:1px solid var(--divider-color); border-radius:16px; padding:10px 14px; }
        .reviewPill { border-color:var(--warning-color, #ff9800); }
        .controls { display:grid; grid-template-columns:1fr 170px 170px; gap:10px; margin-bottom:18px; }
        input, select, button { font:inherit; }
        input:not([type=file]), select { box-sizing:border-box; width:100%; padding:12px; border-radius:12px; border:1px solid var(--divider-color); background:var(--card-background-color); color:var(--primary-text-color); }
        button { border:0; border-radius:12px; padding:10px 14px; cursor:pointer; background:var(--primary-color); color:var(--text-primary-color, white); }
        button:disabled { opacity:.35; cursor:not-allowed; }
        .secondary { background:var(--secondary-background-color); color:var(--primary-text-color); }
        .dangerBtn { background:transparent; color:var(--error-color); border:1px solid var(--error-color); }
        .grid { display:grid; gap:12px; }
        .item { background:var(--card-background-color); border:1px solid var(--divider-color); border-radius:18px; padding:16px; box-shadow:var(--ha-card-box-shadow, none); }
        .reviewCard { border-color:var(--warning-color, #ff9800); }
        .reviewRequest { margin:14px 0 8px; padding:12px; border-radius:12px; background:var(--secondary-background-color); font-weight:600; }
        .top { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
        h3 { margin:0 0 5px; font-size:20px; }
        .meta { display:flex; flex-wrap:wrap; gap:8px; color:var(--secondary-text-color); font-size:13px; }
        .brand { font-weight:700; color:var(--primary-text-color); }
        .place { padding:6px 10px; border-radius:999px; background:var(--secondary-background-color); white-space:nowrap; }
        .middle { display:flex; gap:18px; align-items:center; margin:15px 0; }
        .stock { min-width:86px; text-align:center; padding:10px; background:var(--secondary-background-color); border-radius:14px; }
        .stock strong { display:block; font-size:30px; line-height:1; }
        .stock span { display:block; margin-top:5px; color:var(--secondary-text-color); }
        .details { line-height:1.55; color:var(--secondary-text-color); }
        .expiry.danger { color:var(--error-color); font-weight:700; }
        .expiry.warning { color:var(--warning-color, #ff9800); font-weight:700; }
        .expiry.ok { color:var(--success-color, #43a047); }
        .actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
        .empty, .error { padding:28px; text-align:center; border-radius:18px; background:var(--card-background-color); }
        .error { color:var(--error-color); }
        @media (max-width:700px) {
          .wrap { padding:12px; }
          .controls { grid-template-columns:1fr 1fr; }
          .controls #search { grid-column:1 / -1; }
          header { align-items:flex-start; } h1 { font-size:24px; }
          .middle { align-items:flex-start; }
          .actions button { flex:1 1 auto; }
        }
      </style>
      <div class="wrap">
        <header>
          <div><h1>Food Scanner</h1><div class="sub">Magazzino alimenti e scadenze</div></div>
          <button id="refresh">Aggiorna</button>
        </header>
        <div class="summary">
          <div class="pill"><strong>${items.length}</strong> lotti visualizzati</div>
          <div class="pill"><strong>${totalUnits}</strong> unità visualizzate</div>
          ${reviews.length ? `<div class="pill reviewPill"><strong>${reviews.length}</strong> da verificare</div>` : ""}
        </div>

        ${reviews.length ? `<h2>Da verificare</h2><div class="grid">${reviewCards}</div>` : ""}

        <h2>Magazzino</h2>
        <div class="controls">
          <input id="search" placeholder="Cerca prodotto, marca o EAN…" value="${this._esc(this._filters.search)}">
          <select id="location">
            <option value="" ${!this._filters.location ? "selected" : ""}>Tutte le posizioni</option>
            <option value="frigo" ${this._filters.location === "frigo" ? "selected" : ""}>Frigo</option>
            <option value="freezer" ${this._filters.location === "freezer" ? "selected" : ""}>Freezer</option>
            <option value="dispensa" ${this._filters.location === "dispensa" ? "selected" : ""}>Dispensa</option>
          </select>
          <select id="sort">
            <option value="expiry" ${this._filters.sort === "expiry" ? "selected" : ""}>Per scadenza</option>
            <option value="name" ${this._filters.sort === "name" ? "selected" : ""}>Alfabetico</option>
            <option value="added" ${this._filters.sort === "added" ? "selected" : ""}>Per inserimento</option>
          </select>
        </div>
        ${this._error ? `<div class="error">${this._esc(this._error)}</div>` : ""}
        ${this._loading ? `<div class="empty">Caricamento…</div>` : items.length ? `<div class="grid">${cards}</div>` : `<div class="empty">Nessun prodotto trovato.</div>`}
      </div>`;
    this._bind();
  }
}

if (!customElements.get("food-scanner-panel")) {
  customElements.define("food-scanner-panel", FoodScannerPanel);
}
