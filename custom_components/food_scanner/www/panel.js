class FoodScannerPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._items = [];
    this._reviews = [];
    this._summary = {};
    this._settings = {};
    this._loading = false;
    this._error = "";
    this._tab = "inventory";
    this._filters = { location: "", sort: "expiry", search: "" };
    this._modal = null;
    this._searchTimer = null;
  }

  set hass(value) {
    const first = !this._hass;
    this._hass = value;
    if (first) this._load();
  }

  set panel(value) {
    this._panel = value;
  }

  connectedCallback() {
    this._render();
  }

  _esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  _labelLocation(value) {
    return {
      frigo: "Frigo",
      freezer: "Freezer",
      dispensa: "Dispensa",
    }[value] || "Senza posizione";
  }

  _locationIcon(value) {
    return {
      frigo: "mdi:fridge-outline",
      freezer: "mdi:snowflake",
      dispensa: "mdi:cupboard-outline",
    }[value] || "mdi:map-marker-question-outline";
  }

  _formatDate(value) {
    if (!value) return "Nessuna scadenza";
    const parts = String(value).split("-");
    if (parts.length !== 3) return String(value);
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  _daysUntil(value) {
    if (!value) return null;
    const d = new Date(`${value}T12:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    return Math.round((d - today) / 86400000);
  }

  _expiryInfo(value) {
    const days = this._daysUntil(value);
    if (days === null) return { text: "Nessuna scadenza", cls: "neutral", days: null };
    if (days < 0) return { text: `Scaduto da ${Math.abs(days)} g`, cls: "danger", days };
    if (days === 0) return { text: "Scade oggi", cls: "danger", days };
    if (days === 1) return { text: "Scade domani", cls: "warning", days };
    if (days <= 3) return { text: `Tra ${days} giorni`, cls: "warning", days };
    if (days <= 7) return { text: `Tra ${days} giorni`, cls: "soon", days };
    return { text: `Tra ${days} giorni`, cls: "ok", days };
  }

  _mimeFromFile(file) {
    if (file.type) return file.type;
    const name = String(file.name || "").toLowerCase();
    if (name.endsWith(".heic")) return "image/heic";
    if (name.endsWith(".heif")) return "image/heif";
    if (name.endsWith(".png")) return "image/png";
    if (name.endsWith(".webp")) return "image/webp";
    return "image/jpeg";
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
      this._summary = data.summary || {};
      this._settings = data.settings || {};
    } catch (err) {
      this._error = err?.message || String(err);
    } finally {
      this._loading = false;
      this._render();
    }
  }

  async _post(payload) {
    const result = await this._hass.callApi("POST", "food_scanner/archive", payload);
    await this._load();
    return result;
  }

  async _consume(id, amount) {
    try {
      await this._post({ action: "consume", id, amount });
    } catch (err) {
      alert(err?.message || err);
    }
  }

  async _consumeCustom(item) {
    const max = Number(item.stock_units || 1);
    const value = prompt(`Quante ${item.unit_name || "unità"} vuoi togliere? Disponibili: ${max}`, "1");
    if (value === null) return;
    const amount = Number.parseInt(value, 10);
    if (!Number.isInteger(amount) || amount < 1) return alert("Quantità non valida");
    await this._consume(item.id, amount);
  }

  async _deleteLot(item) {
    if (!confirm(`Eliminare completamente il lotto “${item.product_name || "Prodotto"}”?`)) return;
    try {
      await this._hass.callApi("DELETE", `food_scanner/archive?id=${encodeURIComponent(item.id)}`);
      await this._load();
    } catch (err) {
      alert(err?.message || err);
    }
  }

  _openEdit(item) {
    this._modal = { type: "edit", item: { ...item } };
    this._render();
  }

  _openAdd() {
    this._modal = {
      type: "add",
      item: {
        product_name: "",
        brand: "",
        quantity: "",
        barcode: "",
        expiry_date: "",
        expiry_type: "scadenza",
        location: "dispensa",
        package_type: "confezione",
        unit_name: "unità",
        units_per_package: 1,
        stock_units: 1,
      },
    };
    this._render();
  }

  _closeModal() {
    this._modal = null;
    this._render();
  }

  async _saveItemModal() {
    const form = this.shadowRoot.querySelector("#itemForm");
    if (!form) return;
    const fd = new FormData(form);
    const changes = {
      product_name: String(fd.get("product_name") || "").trim(),
      brand: String(fd.get("brand") || "").trim(),
      quantity: String(fd.get("quantity") || "").trim(),
      barcode: String(fd.get("barcode") || "").trim(),
      expiry_date: String(fd.get("expiry_date") || "").trim(),
      expiry_type: String(fd.get("expiry_type") || "").trim(),
      location: String(fd.get("location") || "").trim(),
      package_type: String(fd.get("package_type") || "").trim(),
      unit_name: String(fd.get("unit_name") || "").trim(),
      units_per_package: Number.parseInt(String(fd.get("units_per_package") || "1"), 10),
    };
    const stock = Number.parseInt(String(fd.get("stock_units") || "1"), 10);

    if (!changes.product_name) return alert("Inserisci il nome del prodotto");
    if (!Number.isInteger(changes.units_per_package) || changes.units_per_package < 1) {
      return alert("Unità per confezione non valide");
    }
    if (!Number.isInteger(stock) || stock < 0) return alert("Quantità in magazzino non valida");

    try {
      if (this._modal.type === "add") {
        if (stock < 1) return alert("Per aggiungere un prodotto servono almeno 1 unità");
        changes.stock_units = stock;
        await this._post({ action: "add_manual", changes });
      } else {
        const original = this._modal.item;
        const result = await this._hass.callApi("POST", "food_scanner/archive", {
          action: "update_item",
          id: original.id,
          changes,
        });
        const currentId = result?.item?.id || original.id;
        const currentStock = Number(original.stock_units || 1);
        if (stock !== currentStock) {
          await this._hass.callApi("POST", "food_scanner/archive", {
            action: "set_stock",
            id: currentId,
            amount: stock,
          });
        }
        await this._load();
      }
      this._modal = null;
      this._render();
    } catch (err) {
      alert(err?.message || err);
    }
  }

  async _retryReview(review, file) {
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) return alert("La foto supera 12 MB");
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error("Lettura foto fallita"));
        reader.readAsDataURL(file);
      });
      const raw = String(dataUrl).split(",", 2)[1] || "";
      const result = await this._post({
        action: "retry_review",
        id: review.id,
        mime_type: this._mimeFromFile(file),
        image_data: raw,
      });
      if (result?.status === "archived") alert("Prodotto verificato e salvato in magazzino");
      else alert("La nuova foto è stata analizzata, ma serve ancora una verifica");
    } catch (err) {
      alert(err?.message || err);
    }
  }

  async _confirmReview(review) {
    if (!confirm("Salvare comunque questi dati in magazzino?")) return;
    try {
      await this._post({ action: "confirm_review", id: review.id });
    } catch (err) {
      alert(err?.message || err);
    }
  }

  async _discardReview(review) {
    if (!confirm("Scartare questa scansione?")) return;
    try {
      await this._post({ action: "discard_review", id: review.id });
    } catch (err) {
      alert(err?.message || err);
    }
  }

  async _saveSettings() {
    const form = this.shadowRoot.querySelector("#settingsForm");
    if (!form) return;
    const fd = new FormData(form);
    const days = Number.parseInt(String(fd.get("expiry_notify_days") || "0"), 10);
    if (!Number.isInteger(days) || days < 0 || days > 365) {
      return alert("Inserisci un preavviso tra 0 e 365 giorni");
    }
    try {
      await this._post({
        action: "update_settings",
        notify: fd.get("notify") === "on",
        expiry_notify: fd.get("expiry_notify") === "on",
        expiry_notify_days: days,
        expiry_notify_service: String(fd.get("expiry_notify_service") || "").trim(),
        model: String(fd.get("model") || "").trim(),
      });
      alert("Impostazioni salvate");
    } catch (err) {
      alert(err?.message || err);
    }
  }

  _bind() {
    const root = this.shadowRoot;
    if (!root) return;

    root.querySelectorAll("[data-tab]").forEach((btn) => {
      btn.onclick = () => {
        this._tab = btn.dataset.tab;
        this._render();
      };
    });

    const location = root.querySelector("#location");
    const sort = root.querySelector("#sort");
    const search = root.querySelector("#search");
    if (location) location.onchange = () => { this._filters.location = location.value; this._load(); };
    if (sort) sort.onchange = () => { this._filters.sort = sort.value; this._load(); };
    if (search) {
      search.oninput = () => {
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => {
          this._filters.search = search.value.trim();
          this._load();
        }, 300);
      };
    }

    const refresh = root.querySelector("#refresh");
    if (refresh) refresh.onclick = () => this._load();
    const add = root.querySelector("#addManual");
    if (add) add.onclick = () => this._openAdd();

    root.querySelectorAll("[data-action='minus1']").forEach((btn) => {
      btn.onclick = () => this._consume(btn.dataset.id, 1);
    });
    root.querySelectorAll("[data-action='consume']").forEach((btn) => {
      btn.onclick = () => {
        const item = this._items.find((x) => x.id === btn.dataset.id);
        if (item) this._consumeCustom(item);
      };
    });
    root.querySelectorAll("[data-action='edit']").forEach((btn) => {
      btn.onclick = () => {
        const item = this._items.find((x) => x.id === btn.dataset.id);
        if (item) this._openEdit(item);
      };
    });
    root.querySelectorAll("[data-action='delete']").forEach((btn) => {
      btn.onclick = () => {
        const item = this._items.find((x) => x.id === btn.dataset.id);
        if (item) this._deleteLot(item);
      };
    });

    root.querySelectorAll("[data-action='retry']").forEach((btn) => {
      btn.onclick = () => root.querySelector(`#retry-${btn.dataset.id}`)?.click();
    });
    root.querySelectorAll(".retryInput").forEach((input) => {
      input.onchange = () => {
        const review = this._reviews.find((x) => x.id === input.dataset.id);
        if (review && input.files?.[0]) this._retryReview(review, input.files[0]);
      };
    });
    root.querySelectorAll("[data-action='confirm-review']").forEach((btn) => {
      btn.onclick = () => {
        const review = this._reviews.find((x) => x.id === btn.dataset.id);
        if (review) this._confirmReview(review);
      };
    });
    root.querySelectorAll("[data-action='discard-review']").forEach((btn) => {
      btn.onclick = () => {
        const review = this._reviews.find((x) => x.id === btn.dataset.id);
        if (review) this._discardReview(review);
      };
    });

    const saveSettings = root.querySelector("#saveSettings");
    if (saveSettings) saveSettings.onclick = () => this._saveSettings();
    const integrationSettings = root.querySelector("#integrationSettings");
    if (integrationSettings) integrationSettings.onclick = () => {
      window.location.href = "/config/integrations/integration/food_scanner";
    };

    const modalClose = root.querySelector("#modalClose");
    if (modalClose) modalClose.onclick = () => this._closeModal();
    const modalCancel = root.querySelector("#modalCancel");
    if (modalCancel) modalCancel.onclick = () => this._closeModal();
    const modalSave = root.querySelector("#modalSave");
    if (modalSave) modalSave.onclick = () => this._saveItemModal();
    const backdrop = root.querySelector(".modalBackdrop");
    if (backdrop) backdrop.onclick = (ev) => {
      if (ev.target === backdrop) this._closeModal();
    };
  }

  _renderSummary() {
    const s = this._summary || {};
    const next = s.next_expiry || null;
    const nextInfo = next ? this._expiryInfo(next.expiry_date) : null;
    return `
      <div class="summaryGrid">
        <div class="summaryCard blue">
          <div class="summaryIcon"><ha-icon icon="mdi:package-variant-closed"></ha-icon></div>
          <div><div class="summaryValue">${Number(s.total_units || 0)}</div><div class="summaryLabel">unità in casa</div></div>
        </div>
        <div class="summaryCard purple">
          <div class="summaryIcon"><ha-icon icon="mdi:layers-triple-outline"></ha-icon></div>
          <div><div class="summaryValue">${Number(s.lots || 0)}</div><div class="summaryLabel">lotti distinti</div></div>
        </div>
        <div class="summaryCard ${this._reviews.length ? "orange" : "green"}">
          <div class="summaryIcon"><ha-icon icon="mdi:camera-retake-outline"></ha-icon></div>
          <div><div class="summaryValue">${this._reviews.length}</div><div class="summaryLabel">da verificare</div></div>
        </div>
        <div class="summaryCard ${nextInfo?.cls === "danger" ? "red" : nextInfo?.cls === "warning" ? "orange" : "green"}">
          <div class="summaryIcon"><ha-icon icon="mdi:calendar-clock-outline"></ha-icon></div>
          <div>
            <div class="summaryValue small">${next ? this._esc(this._formatDate(next.expiry_date)) : "—"}</div>
            <div class="summaryLabel">${next ? this._esc(next.product_name || "Prossima scadenza") : "nessuna scadenza"}</div>
          </div>
        </div>
      </div>`;
  }

  _renderInventory() {
    const cards = this._items.map((item) => {
      const expiry = this._expiryInfo(item.expiry_date);
      const stock = Number(item.stock_units || 1);
      const unitName = item.unit_name || "unità";
      const perPack = Number(item.units_per_package || 1);
      const packText = perPack > 1
        ? `${item.package_type || "confezione"} da ${perPack} ${unitName}`
        : (item.package_type || "confezione");
      return `
        <article class="productCard">
          <div class="productTop">
            <div class="productIdentity">
              <div class="productIcon"><ha-icon icon="mdi:food-variant"></ha-icon></div>
              <div>
                <h3>${this._esc(item.product_name || "Prodotto")}</h3>
                <div class="productMeta">
                  ${item.brand ? `<span>${this._esc(item.brand)}</span>` : ""}
                  ${item.quantity ? `<span>${this._esc(item.quantity)}</span>` : ""}
                  ${item.barcode ? `<span>EAN ${this._esc(item.barcode)}</span>` : ""}
                </div>
              </div>
            </div>
            <div class="locationChip ${this._esc(item.location || "none")}">
              <ha-icon icon="${this._locationIcon(item.location)}"></ha-icon>
              ${this._esc(this._labelLocation(item.location))}
            </div>
          </div>
          <div class="productBody">
            <div class="stockBlock">
              <div class="stockNumber">${stock}</div>
              <div class="stockUnit">${this._esc(unitName)}</div>
            </div>
            <div class="productDetails">
              <div class="detailLine"><ha-icon icon="mdi:package-variant"></ha-icon><span>${this._esc(packText)}</span></div>
              <div class="detailLine"><ha-icon icon="mdi:calendar-outline"></ha-icon><span>${this._esc(this._formatDate(item.expiry_date))}</span><span class="expiry ${expiry.cls}">${this._esc(expiry.text)}</span></div>
              ${item.expiry_type ? `<div class="detailLine subtle"><ha-icon icon="mdi:information-outline"></ha-icon><span>${this._esc(item.expiry_type)}</span></div>` : ""}
            </div>
          </div>
          <div class="actions">
            <button class="roundAction" data-action="minus1" data-id="${this._esc(item.id)}" title="Togli 1"><ha-icon icon="mdi:minus"></ha-icon></button>
            <button class="primaryAction" data-action="consume" data-id="${this._esc(item.id)}"><ha-icon icon="mdi:silverware-fork-knife"></ha-icon><span>Consuma</span></button>
            <button class="ghostAction" data-action="edit" data-id="${this._esc(item.id)}"><ha-icon icon="mdi:pencil-outline"></ha-icon><span>Modifica</span></button>
            <button class="dangerAction" data-action="delete" data-id="${this._esc(item.id)}"><ha-icon icon="mdi:trash-can-outline"></ha-icon></button>
          </div>
        </article>`;
    }).join("");

    return `
      <div class="toolbar">
        <div class="searchWrap"><ha-icon icon="mdi:magnify"></ha-icon><input id="search" placeholder="Cerca prodotto, marca o EAN…" value="${this._esc(this._filters.search)}"></div>
        <select id="location">
          <option value="" ${!this._filters.location ? "selected" : ""}>Tutte le zone</option>
          <option value="frigo" ${this._filters.location === "frigo" ? "selected" : ""}>Frigo</option>
          <option value="freezer" ${this._filters.location === "freezer" ? "selected" : ""}>Freezer</option>
          <option value="dispensa" ${this._filters.location === "dispensa" ? "selected" : ""}>Dispensa</option>
        </select>
        <select id="sort">
          <option value="expiry" ${this._filters.sort === "expiry" ? "selected" : ""}>Scadenza</option>
          <option value="name" ${this._filters.sort === "name" ? "selected" : ""}>Alfabetico</option>
          <option value="added" ${this._filters.sort === "added" ? "selected" : ""}>Inserimento</option>
        </select>
        <button id="addManual" class="addButton"><ha-icon icon="mdi:plus"></ha-icon><span>Aggiungi</span></button>
      </div>
      ${this._loading ? `<div class="emptyState"><div class="spinner"></div><span>Caricamento magazzino…</span></div>` :
        this._items.length ? `<div class="productGrid">${cards}</div>` : `<div class="emptyState"><ha-icon icon="mdi:food-off-outline"></ha-icon><h3>Nessun prodotto</h3><p>Scansiona dall’iPhone oppure usa “Aggiungi”.</p></div>`}`;
  }

  _renderReviews() {
    if (!this._reviews.length) {
      return `<div class="emptyState success"><ha-icon icon="mdi:check-circle-outline"></ha-icon><h3>Tutto verificato</h3><p>Non ci sono scansioni che richiedono un’altra foto.</p></div>`;
    }

    const cards = this._reviews.map((review) => {
      const food = review.food || {};
      const missing = Array.isArray(food.missing_fields) ? food.missing_fields.filter(Boolean) : [];
      return `
        <article class="reviewCard">
          <div class="reviewHead">
            <div class="reviewIcon"><ha-icon icon="mdi:camera-retake-outline"></ha-icon></div>
            <div><h3>${this._esc(food.product_name || "Prodotto non identificato")}</h3><div class="reviewSub">Tentativo ${Number(review.attempts || 1)} · ${this._esc(this._labelLocation(review.location))}</div></div>
          </div>
          <div class="requestBox">${this._esc(food.photo_request || "Serve una foto più chiara del prodotto e della scadenza.")}</div>
          <div class="reviewData">
            ${food.brand ? `<span>Marca: <strong>${this._esc(food.brand)}</strong></span>` : ""}
            ${food.quantity ? `<span>Formato: <strong>${this._esc(food.quantity)}</strong></span>` : ""}
            ${food.expiry_date ? `<span>Data: <strong>${this._esc(this._formatDate(food.expiry_date))}</strong></span>` : ""}
            ${food.units_per_package ? `<span>Unità rilevate: <strong>${this._esc(food.units_per_package)}</strong></span>` : ""}
            ${food.confidence !== undefined ? `<span>Confidenza: <strong>${this._esc(food.confidence)}%</strong></span>` : ""}
          </div>
          ${missing.length ? `<div class="missing">Manca/incerto: ${missing.map((x) => this._esc(x)).join(" · ")}</div>` : ""}
          <input id="retry-${this._esc(review.id)}" class="retryInput" data-id="${this._esc(review.id)}" type="file" accept="image/*,.heic,.heif" capture="environment">
          <div class="reviewActions">
            <button class="primaryAction" data-action="retry" data-id="${this._esc(review.id)}"><ha-icon icon="mdi:camera-plus-outline"></ha-icon><span>Fotografa di nuovo</span></button>
            <button class="ghostAction" data-action="confirm-review" data-id="${this._esc(review.id)}"><ha-icon icon="mdi:check"></ha-icon><span>Salva comunque</span></button>
            <button class="dangerAction text" data-action="discard-review" data-id="${this._esc(review.id)}"><ha-icon icon="mdi:close"></ha-icon><span>Scarta</span></button>
          </div>
        </article>`;
    }).join("");

    return `<div class="reviewIntro"><ha-icon icon="mdi:information-outline"></ha-icon><span>Puoi continuare a scansionare normalmente: ogni richiesta resta collegata al prodotto giusto.</span></div><div class="reviewGrid">${cards}</div>`;
  }

  _renderSettings() {
    const s = this._settings || {};
    return `
      <div class="settingsGrid">
        <section class="glassSection">
          <div class="sectionTitle"><ha-icon icon="mdi:bell-ring-outline"></ha-icon><div><h3>Scadenze</h3><p>Decidi quando vuoi essere avvisato.</p></div></div>
          <form id="settingsForm">
            <label class="toggleRow"><span><strong>Notifiche scansione</strong><small>Mostra il risultato dopo una scansione riuscita.</small></span><input type="checkbox" name="notify" ${s.notify !== false ? "checked" : ""}><i></i></label>
            <label class="toggleRow"><span><strong>Notifiche scadenza</strong><small>Controllo automatico giornaliero.</small></span><input type="checkbox" name="expiry_notify" ${s.expiry_notify !== false ? "checked" : ""}><i></i></label>
            <label class="field"><span>Giorni di preavviso</span><input type="number" name="expiry_notify_days" min="0" max="365" value="${this._esc(s.expiry_notify_days ?? 3)}"></label>
            <label class="field"><span>Servizio notifica iPhone <small>(facoltativo)</small></span><input name="expiry_notify_service" placeholder="notify.mobile_app_iphone" value="${this._esc(s.expiry_notify_service || "")}"><small>Se lasci vuoto e hai un solo dispositivo mobile, Food Scanner prova a usarlo automaticamente.</small></label>
            <label class="field"><span>Modello Gemini</span><input name="model" value="${this._esc(s.model || "gemini-3.5-flash-lite")}"></label>
            <div class="settingsActions"><button type="button" id="saveSettings" class="primaryAction"><ha-icon icon="mdi:content-save-outline"></ha-icon><span>Salva impostazioni</span></button><button type="button" id="integrationSettings" class="ghostAction"><ha-icon icon="mdi:cog-outline"></ha-icon><span>Integrazione</span></button></div>
          </form>
        </section>
        <section class="glassSection compactInfo">
          <div class="sectionTitle"><ha-icon icon="mdi:shield-check-outline"></ha-icon><div><h3>Controlli automatici</h3><p>Food Scanner non archivia alla cieca.</p></div></div>
          <div class="infoList">
            <div><ha-icon icon="mdi:calendar-search"></ha-icon><span>Scadenza non leggibile → <strong>Da verificare</strong></span></div>
            <div><ha-icon icon="mdi:package-variant"></ha-icon><span>Multipack incerto → richiede foto quantità</span></div>
            <div><ha-icon icon="mdi:percent-outline"></ha-icon><span>Confidenza bassa → non salva automaticamente</span></div>
            <div><ha-icon icon="mdi:database-lock-outline"></ha-icon><span>Archivio persistente separato dal Recorder</span></div>
          </div>
        </section>
      </div>`;
  }

  _renderModal() {
    if (!this._modal) return "";
    const item = this._modal.item || {};
    const title = this._modal.type === "add" ? "Aggiungi prodotto" : "Modifica prodotto";
    return `
      <div class="modalBackdrop">
        <div class="modalCard">
          <div class="modalHead"><div><h2>${title}</h2><p>Correggi i dati senza dover rifare tutto.</p></div><button id="modalClose" class="iconButton"><ha-icon icon="mdi:close"></ha-icon></button></div>
          <form id="itemForm" class="formGrid">
            <label class="field full"><span>Nome prodotto</span><input name="product_name" required value="${this._esc(item.product_name || "")}"></label>
            <label class="field"><span>Marca</span><input name="brand" value="${this._esc(item.brand || "")}"></label>
            <label class="field"><span>Formato commerciale</span><input name="quantity" placeholder="es. 3 x 80 g" value="${this._esc(item.quantity || "")}"></label>
            <label class="field"><span>EAN / GTIN</span><input name="barcode" inputmode="numeric" value="${this._esc(item.barcode || "")}"></label>
            <label class="field"><span>Scadenza</span><input type="date" name="expiry_date" value="${this._esc(item.expiry_date || "")}"></label>
            <label class="field"><span>Tipo data</span><select name="expiry_type"><option value="scadenza" ${item.expiry_type === "scadenza" ? "selected" : ""}>Scadenza</option><option value="TMC" ${item.expiry_type === "TMC" ? "selected" : ""}>TMC</option><option value="" ${!item.expiry_type ? "selected" : ""}>Non specificato</option></select></label>
            <label class="field"><span>Posizione</span><select name="location"><option value="frigo" ${item.location === "frigo" ? "selected" : ""}>Frigo</option><option value="freezer" ${item.location === "freezer" ? "selected" : ""}>Freezer</option><option value="dispensa" ${item.location === "dispensa" ? "selected" : ""}>Dispensa</option></select></label>
            <label class="field"><span>Tipo confezione</span><input name="package_type" placeholder="scatola, bottiglia…" value="${this._esc(item.package_type || "confezione")}"></label>
            <label class="field"><span>Nome unità</span><input name="unit_name" placeholder="merendine, lattine…" value="${this._esc(item.unit_name || "unità")}"></label>
            <label class="field"><span>Unità per confezione</span><input type="number" min="1" name="units_per_package" value="${this._esc(item.units_per_package || 1)}"></label>
            <label class="field"><span>Disponibili in magazzino</span><input type="number" min="0" name="stock_units" value="${this._esc(item.stock_units || 1)}"></label>
          </form>
          <div class="modalActions"><button id="modalCancel" class="ghostAction">Annulla</button><button id="modalSave" class="primaryAction"><ha-icon icon="mdi:check"></ha-icon><span>Salva</span></button></div>
        </div>
      </div>`;
  }

  _render() {
    if (!this.shadowRoot) return;
    const reviewBadge = this._reviews.length ? `<span class="badge">${this._reviews.length}</span>` : "";
    const content = this._tab === "review" ? this._renderReviews() : this._tab === "settings" ? this._renderSettings() : this._renderInventory();

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          min-height: 100%;
          color: #f7f9ff;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
          --glass: rgba(18, 20, 28, .62);
          --glass-strong: rgba(21, 24, 34, .82);
          --border: rgba(255, 255, 255, .09);
          --muted: rgba(231, 236, 255, .58);
          --blue: #7ed7ff;
          --purple: #ad8cff;
          --green: #68e7a7;
          --orange: #ffb45e;
          --red: #ff6f7d;
        }
        * { box-sizing: border-box; }
        ha-icon { --mdc-icon-size: 21px; }
        .page {
          min-height: 100vh;
          padding: 24px;
          background:
            radial-gradient(circle at 8% 0%, rgba(98, 78, 255, .20), transparent 30%),
            radial-gradient(circle at 92% 10%, rgba(65, 185, 255, .16), transparent 28%),
            radial-gradient(circle at 50% 100%, rgba(43, 219, 148, .09), transparent 30%),
            #08090d;
        }
        .shell { max-width: 1380px; margin: 0 auto; }
        .hero { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; padding: 8px 2px 22px; }
        .hero h1 { font-size: clamp(30px, 4vw, 46px); letter-spacing: -.04em; margin: 0; font-weight: 730; }
        .hero p { margin: 8px 0 0; color: var(--muted); font-size: 15px; }
        .heroActions { display: flex; gap: 10px; }
        button, input, select { font: inherit; }
        button { border: 0; cursor: pointer; }
        .iconButton, .refreshButton {
          width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center;
          color: #fff; background: rgba(255,255,255,.07); border: 1px solid var(--border);
          backdrop-filter: blur(18px);
        }
        .summaryGrid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 13px; margin-bottom: 18px; }
        .summaryCard {
          min-height: 112px; border-radius: 30px; padding: 20px; display: flex; align-items: center; gap: 16px;
          background: linear-gradient(145deg, rgba(255,255,255,.085), rgba(255,255,255,.025));
          border: 1px solid var(--border); backdrop-filter: blur(24px);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 20px 50px rgba(0,0,0,.24);
        }
        .summaryCard.blue { box-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 0 45px rgba(86,183,255,.06); }
        .summaryCard.purple { box-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 0 45px rgba(153,107,255,.07); }
        .summaryCard.green { box-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 0 45px rgba(67,218,146,.06); }
        .summaryCard.orange { box-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 0 45px rgba(255,168,69,.07); }
        .summaryCard.red { box-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 0 45px rgba(255,91,112,.08); }
        .summaryIcon { width: 54px; height: 54px; border-radius: 19px; display: grid; place-items: center; background: rgba(255,255,255,.065); }
        .blue .summaryIcon { color: var(--blue); } .purple .summaryIcon { color: var(--purple); } .green .summaryIcon { color: var(--green); } .orange .summaryIcon { color: var(--orange); } .red .summaryIcon { color: var(--red); }
        .summaryIcon ha-icon { --mdc-icon-size: 27px; }
        .summaryValue { font-size: 31px; font-weight: 760; letter-spacing: -.04em; line-height: 1; }
        .summaryValue.small { font-size: 21px; }
        .summaryLabel { color: var(--muted); margin-top: 7px; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 190px; }
        .navTabs {
          display: inline-flex; gap: 5px; padding: 5px; border-radius: 20px; margin-bottom: 18px;
          background: rgba(255,255,255,.045); border: 1px solid var(--border); backdrop-filter: blur(20px);
        }
        .tabButton { position: relative; display: flex; align-items: center; gap: 8px; padding: 11px 16px; border-radius: 15px; color: var(--muted); background: transparent; }
        .tabButton.active { color: #fff; background: rgba(255,255,255,.10); box-shadow: inset 0 1px 0 rgba(255,255,255,.06); }
        .badge { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px; display: inline-grid; place-items: center; background: var(--orange); color: #1d1205; font-size: 11px; font-weight: 800; }
        .toolbar { display: grid; grid-template-columns: minmax(260px, 1fr) 180px 170px auto; gap: 10px; margin-bottom: 16px; }
        .searchWrap { position: relative; }
        .searchWrap ha-icon { position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: var(--muted); }
        input, select {
          width: 100%; min-height: 48px; border-radius: 17px; border: 1px solid var(--border); outline: none;
          background: rgba(255,255,255,.055); color: #fff; padding: 0 14px; backdrop-filter: blur(18px);
        }
        .searchWrap input { padding-left: 44px; }
        input:focus, select:focus { border-color: rgba(126,215,255,.38); box-shadow: 0 0 0 3px rgba(126,215,255,.06); }
        select option { color: #111; }
        .addButton, .primaryAction, .ghostAction, .dangerAction, .roundAction {
          min-height: 44px; border-radius: 15px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 14px;
        }
        .addButton, .primaryAction { color: #071019; background: linear-gradient(135deg, #b9eaff, #78caff); box-shadow: 0 10px 30px rgba(82,181,255,.13); font-weight: 700; }
        .ghostAction { color: #fff; background: rgba(255,255,255,.07); border: 1px solid var(--border); }
        .dangerAction { color: var(--red); background: rgba(255,91,112,.08); border: 1px solid rgba(255,91,112,.18); }
        .dangerAction.text { padding-inline: 15px; }
        .roundAction { width: 44px; padding: 0; color: #fff; background: rgba(255,255,255,.07); border: 1px solid var(--border); }
        .productGrid, .reviewGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 13px; }
        .productCard, .reviewCard, .glassSection {
          border-radius: 32px; padding: 20px; background: var(--glass); border: 1px solid var(--border); backdrop-filter: blur(26px);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.035), 0 22px 55px rgba(0,0,0,.26);
        }
        .productTop { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .productIdentity { display: flex; align-items: center; gap: 13px; min-width: 0; }
        .productIcon, .reviewIcon { width: 48px; height: 48px; border-radius: 18px; display: grid; place-items: center; flex: 0 0 auto; background: rgba(255,255,255,.065); color: var(--blue); }
        h3 { margin: 0; font-size: 19px; letter-spacing: -.02em; }
        .productMeta { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 6px; color: var(--muted); font-size: 12px; }
        .productMeta span + span::before { content: "·"; margin-right: 7px; color: rgba(255,255,255,.25); }
        .locationChip { display: flex; align-items: center; gap: 6px; padding: 7px 10px; border-radius: 999px; font-size: 12px; white-space: nowrap; background: rgba(255,255,255,.06); color: #dfe7ff; }
        .locationChip.frigo { color: #9edfff; background: rgba(77,181,255,.09); }
        .locationChip.freezer { color: #b7f4ff; background: rgba(82,225,255,.08); }
        .locationChip.dispensa { color: #d1baff; background: rgba(164,116,255,.10); }
        .locationChip ha-icon { --mdc-icon-size: 17px; }
        .productBody { display: flex; gap: 18px; align-items: center; padding: 18px 0 16px; }
        .stockBlock { min-width: 92px; padding: 14px 10px; text-align: center; border-radius: 22px; background: rgba(255,255,255,.055); }
        .stockNumber { font-size: 38px; line-height: 1; font-weight: 760; letter-spacing: -.05em; }
        .stockUnit { margin-top: 5px; color: var(--muted); font-size: 12px; max-width: 110px; overflow: hidden; text-overflow: ellipsis; }
        .productDetails { display: grid; gap: 7px; min-width: 0; }
        .detailLine { display: flex; align-items: center; gap: 7px; color: #e8ebf6; font-size: 13px; flex-wrap: wrap; }
        .detailLine ha-icon { color: var(--muted); --mdc-icon-size: 18px; }
        .detailLine.subtle { color: var(--muted); }
        .expiry { padding: 4px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
        .expiry.danger { color: #ffd5da; background: rgba(255,91,112,.15); }
        .expiry.warning { color: #ffe0b0; background: rgba(255,164,67,.13); }
        .expiry.soon { color: #fff0b2; background: rgba(255,214,74,.10); }
        .expiry.ok { color: #bdf5d5; background: rgba(67,218,146,.10); }
        .expiry.neutral { color: var(--muted); background: rgba(255,255,255,.05); }
        .actions, .reviewActions { display: flex; gap: 8px; flex-wrap: wrap; }
        .actions .primaryAction, .actions .ghostAction { flex: 1; }
        .reviewIntro { display: flex; align-items: center; gap: 10px; padding: 13px 15px; margin-bottom: 14px; border-radius: 18px; background: rgba(255,180,94,.07); color: #ffd9ac; border: 1px solid rgba(255,180,94,.12); }
        .reviewHead { display: flex; align-items: center; gap: 13px; }
        .reviewIcon { color: var(--orange); }
        .reviewSub { color: var(--muted); font-size: 12px; margin-top: 4px; }
        .requestBox { margin: 16px 0 12px; padding: 13px 14px; border-radius: 17px; background: rgba(255,180,94,.075); color: #ffe0bb; line-height: 1.45; }
        .reviewData { display: flex; flex-wrap: wrap; gap: 8px 13px; color: var(--muted); font-size: 12px; margin-bottom: 12px; }
        .reviewData strong { color: #fff; }
        .missing { color: #ffbdc5; font-size: 12px; margin: 0 0 14px; }
        .retryInput { display: none; }
        .settingsGrid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(300px, .75fr); gap: 13px; }
        .sectionTitle { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 18px; }
        .sectionTitle > ha-icon { color: var(--purple); --mdc-icon-size: 26px; }
        .sectionTitle h3 { font-size: 21px; }
        .sectionTitle p { margin: 5px 0 0; color: var(--muted); font-size: 13px; }
        .toggleRow { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,.055); cursor: pointer; }
        .toggleRow span { display: grid; gap: 4px; }
        .toggleRow small, .field small { color: var(--muted); }
        .toggleRow input { position: absolute; opacity: 0; pointer-events: none; }
        .toggleRow i { width: 48px; height: 28px; border-radius: 20px; background: rgba(255,255,255,.13); position: relative; flex: 0 0 auto; transition: .2s; }
        .toggleRow i::after { content: ""; position: absolute; width: 22px; height: 22px; border-radius: 50%; left: 3px; top: 3px; background: white; transition: .2s; }
        .toggleRow input:checked + i { background: rgba(95,205,255,.75); }
        .toggleRow input:checked + i::after { transform: translateX(20px); }
        .field { display: grid; gap: 7px; margin-top: 14px; color: #e8ebf5; font-size: 13px; }
        .field input, .field select { min-height: 46px; }
        .settingsActions { display: flex; gap: 9px; margin-top: 20px; }
        .compactInfo .infoList { display: grid; gap: 12px; }
        .infoList > div { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 16px; background: rgba(255,255,255,.04); color: #dbe0ef; font-size: 13px; }
        .infoList ha-icon { color: var(--green); }
        .emptyState { min-height: 260px; display: grid; place-items: center; align-content: center; text-align: center; gap: 9px; border-radius: 32px; background: rgba(255,255,255,.035); border: 1px dashed rgba(255,255,255,.09); color: var(--muted); }
        .emptyState > ha-icon { --mdc-icon-size: 48px; color: rgba(255,255,255,.35); }
        .emptyState.success > ha-icon { color: var(--green); }
        .emptyState h3 { color: #fff; margin-top: 8px; }
        .emptyState p { margin: 0; }
        .spinner { width: 34px; height: 34px; border: 3px solid rgba(255,255,255,.1); border-top-color: var(--blue); border-radius: 50%; animation: spin .8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .errorBox { margin-bottom: 14px; padding: 13px 15px; border-radius: 18px; background: rgba(255,91,112,.10); border: 1px solid rgba(255,91,112,.18); color: #ffd6db; }
        .modalBackdrop { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 18px; background: rgba(0,0,0,.70); backdrop-filter: blur(12px); }
        .modalCard { width: min(760px, 100%); max-height: 92vh; overflow: auto; border-radius: 34px; padding: 22px; background: rgba(17,19,27,.96); border: 1px solid rgba(255,255,255,.10); box-shadow: 0 30px 90px rgba(0,0,0,.55); }
        .modalHead { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
        .modalHead h2 { margin: 0; font-size: 25px; letter-spacing: -.03em; }
        .modalHead p { color: var(--muted); margin: 6px 0 0; }
        .formGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 12px; margin-top: 8px; }
        .formGrid .full { grid-column: 1 / -1; }
        .modalActions { display: flex; justify-content: flex-end; gap: 9px; margin-top: 22px; }
        @media (max-width: 980px) {
          .summaryGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .toolbar { grid-template-columns: 1fr 1fr; }
          .searchWrap { grid-column: 1 / -1; }
          .productGrid, .reviewGrid { grid-template-columns: 1fr; }
          .settingsGrid { grid-template-columns: 1fr; }
        }
        @media (max-width: 620px) {
          .page { padding: 14px 11px 30px; }
          .hero { padding-top: 4px; }
          .hero h1 { font-size: 32px; }
          .hero p { max-width: 230px; }
          .summaryGrid { gap: 8px; }
          .summaryCard { min-height: 96px; padding: 14px; border-radius: 25px; gap: 10px; }
          .summaryIcon { width: 44px; height: 44px; border-radius: 16px; }
          .summaryValue { font-size: 27px; }
          .summaryValue.small { font-size: 17px; }
          .summaryLabel { max-width: 125px; }
          .navTabs { width: 100%; display: grid; grid-template-columns: 1fr 1fr 1fr; }
          .tabButton { padding: 10px 8px; justify-content: center; font-size: 12px; }
          .tabButton ha-icon { display: none; }
          .toolbar { grid-template-columns: 1fr 1fr; gap: 8px; }
          .toolbar select { font-size: 13px; }
          .addButton span { display: none; }
          .addButton { min-width: 48px; }
          .productCard, .reviewCard, .glassSection { border-radius: 27px; padding: 16px; }
          .productTop { align-items: flex-start; }
          .locationChip { padding: 6px 8px; }
          .locationChip ha-icon { display: none; }
          .productBody { gap: 12px; }
          .stockBlock { min-width: 78px; }
          .stockNumber { font-size: 33px; }
          .actions .roundAction { flex: 0 0 44px; }
          .actions .primaryAction, .actions .ghostAction { flex: 1 1 110px; }
          .formGrid { grid-template-columns: 1fr; }
          .formGrid .full { grid-column: auto; }
          .modalCard { padding: 17px; border-radius: 28px; }
          .settingsActions { flex-direction: column; }
        }
      </style>
      <div class="page">
        <div class="shell">
          <div class="hero">
            <div><h1>Food Scanner</h1><p>Frigo, freezer e dispensa. Tutto in un unico posto.</p></div>
            <div class="heroActions"><button id="refresh" class="refreshButton" title="Aggiorna"><ha-icon icon="mdi:refresh"></ha-icon></button></div>
          </div>
          ${this._renderSummary()}
          <nav class="navTabs">
            <button data-tab="inventory" class="tabButton ${this._tab === "inventory" ? "active" : ""}"><ha-icon icon="mdi:archive-outline"></ha-icon><span>Magazzino</span></button>
            <button data-tab="review" class="tabButton ${this._tab === "review" ? "active" : ""}"><ha-icon icon="mdi:camera-retake-outline"></ha-icon><span>Da verificare</span>${reviewBadge}</button>
            <button data-tab="settings" class="tabButton ${this._tab === "settings" ? "active" : ""}"><ha-icon icon="mdi:tune-variant"></ha-icon><span>Impostazioni</span></button>
          </nav>
          ${this._error ? `<div class="errorBox">${this._esc(this._error)}</div>` : ""}
          ${content}
        </div>
      </div>
      ${this._renderModal()}
    `;
    this._bind();
  }
}

if (!customElements.get("food-scanner-panel")) {
  customElements.define("food-scanner-panel", FoodScannerPanel);
}
