let selectedHotels = [];
let currentHotels = [];
let allCities = [];
let activeSuggestionIndex = -1;

// ─── Init ───
document.addEventListener("DOMContentLoaded", () => {
  loadStats();
  updateFavCount();
  updateCompareCount();
  loadFavorites();

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-field--city")) {
      hideSuggestions();
    }
  });
});

// ─── Platform Stats ───
function loadStats() {
  fetch("/api/stats")
    .then(res => res.json())
    .then(data => {
      document.getElementById("stat-hotels").textContent = data.total_hotels;
      document.getElementById("stat-cities").textContent = data.total_cities;
      document.getElementById("stat-rating").textContent = data.avg_rating;
    })
    .catch(() => {});
}

// ─── View Switching ───
function switchView(view) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-link").forEach(n => n.classList.remove("active"));

  document.getElementById(`view-${view}`).classList.add("active");
  document.querySelector(`.nav-link[data-view="${view}"]`).classList.add("active");

  if (view === "favorites") loadFavorites();
  if (view === "compare") renderCompareSelection();
}

// ─── Theme ───
function toggleTheme() {
  document.body.classList.toggle("light");
  localStorage.setItem("theme", document.body.classList.contains("light") ? "light" : "dark");
}

if (localStorage.getItem("theme") === "light") {
  document.body.classList.add("light");
}

// ─── Toast ───
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─── Helpers ───
function parsePrice(priceStr) {
  return parseInt(priceStr.replace("₹", "").replace(/,/g, "").split("/")[0], 10);
}

function tierClass(tier) {
  const num = tier ? tier.replace("Tier ", "") : "5";
  return `tier-${num}`;
}

function ratingClass(rating) {
  return parseFloat(rating) >= 9 ? "high" : "";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function showLoading() {
  const results = document.getElementById("results");
  results.innerHTML = `
    <div class="loading-overlay">
      <div class="spinner"></div>
      <p style="color: var(--text-muted)">Searching hotels…</p>
    </div>
  `;
  document.getElementById("results-header").style.display = "none";
}

function showSkeletons(count = 3) {
  const results = document.getElementById("results");
  results.innerHTML = Array(count).fill(`
    <div class="skeleton-card">
      <div class="skeleton-image"></div>
      <div class="skeleton-body">
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
        <div class="skeleton-line" style="margin-top:20px"></div>
      </div>
    </div>
  `).join("");
}

// ─── Hotel Card Renderer ───
function renderHotelCard(hotel, index, options = {}) {
  const { showCompare = true, isBest = false, isAI = false, showRemove = false } = options;
  const price = parsePrice(hotel.price);
  const isSelected = selectedHotels.some(h => h.name === hotel.name);
  const isFav = (JSON.parse(localStorage.getItem("favorites")) || []).some(h => h.name === hotel.name);

  return `
    <div class="hotel-card ${isBest ? "best" : ""} ${isSelected ? "selected" : ""}" data-index="${index}">
      <div class="hotel-image">
        <div class="hotel-image-placeholder ${tierClass(hotel.tier)}">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5">
            <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/>
          </svg>
        </div>
        <div class="hotel-badges">
          <span class="tier-badge">${escapeHtml(hotel.tier || "Tier 5")}</span>
          <span class="rating-badge ${ratingClass(hotel.rating)}">${hotel.rating}</span>
        </div>
        ${isAI ? '<span class="ai-badge">AI Pick</span>' : ""}
        ${isBest && !isAI ? '<span class="ai-badge" style="background:var(--success)">Best Value</span>' : ""}
      </div>
      <div class="hotel-body">
        ${showCompare ? `
          <label class="compare-check">
            <input type="checkbox" ${isSelected ? "checked" : ""} onchange="toggleCompare(${index})" />
            Add to compare
          </label>
        ` : ""}
        <h3 class="hotel-name">${escapeHtml(hotel.name)}</h3>
        <div class="hotel-location">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          ${escapeHtml(hotel.address)}
        </div>
        <div class="hotel-meta">
          <div class="hotel-price">₹${price.toLocaleString("en-IN")}<span> /night</span></div>
          <div class="hotel-reviews">${escapeHtml(hotel.reviews || "")} reviews</div>
        </div>
        <div class="hotel-actions">
          <a class="book-btn" href="${escapeHtml(hotel.link)}" target="_blank" rel="noopener">
            Book Now
          </a>
          ${showRemove
            ? `<button class="btn btn-ghost btn-sm" onclick="removeFavorite(${JSON.stringify(hotel.name)})">Remove</button>`
            : `<button class="btn fav-btn ${isFav ? "active" : ""}" onclick="saveFavoriteByIndex(${index})" title="Save">♥</button>`
          }
        </div>
      </div>
    </div>
  `;
}

function renderResults(hotels, title, options = {}) {
  const results = document.getElementById("results");
  const header = document.getElementById("results-header");

  if (hotels.length === 0) {
    header.style.display = "none";
    results.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
        <h3>No hotels found</h3>
        <p>Try a different city or adjust your budget filter.</p>
      </div>
    `;
    return;
  }

  header.style.display = "flex";
  document.getElementById("results-title").textContent = title;
  document.getElementById("results-count").textContent = `${hotels.length} propert${hotels.length === 1 ? "y" : "ies"} found`;

  let html = "";
  if (options.aiBanner) {
    html += `
      <div class="ai-banner">
        <div class="ai-banner-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.57-3.25 3.92L12 22l-.75-12.08A4.001 4.001 0 0 1 12 2z"/>
          </svg>
        </div>
        <div>
          <h3>AI Recommendation</h3>
          <p>${escapeHtml(options.aiBanner)}</p>
        </div>
      </div>
    `;
  }

  html += hotels.map((hotel, i) => {
    const origIndex = currentHotels.findIndex(h => h.name === hotel.name);
    return renderHotelCard(hotel, origIndex >= 0 ? origIndex : i, options);
  }).join("");

  results.innerHTML = html;
}

// ─── Search ───
function searchHotels() {
  const city = document.getElementById("cityInput").value.trim();

  if (!city) {
    showToast("Please enter a destination", "error");
    return;
  }

  showSkeletons(3);
  switchView("explore");

  fetch("/get_hotels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ city })
  })
    .then(res => res.json())
    .then(data => {
      selectedHotels = [];
      currentHotels = data;
      updateCompareCount();
      applySortFilter();
    })
    .catch(() => {
      showToast("Search failed. Please try again.", "error");
    });
}

// ─── Sort & Filter ───
function applySortFilter() {
  if (!currentHotels.length) return;

  let filtered = [...currentHotels];
  const tier = document.getElementById("tierFilter").value;
  const sort = document.getElementById("sortBy").value;
  const city = document.getElementById("cityInput").value.trim();

  if (tier !== "all") {
    filtered = filtered.filter(h => h.tier === tier);
  }

  filtered.sort((a, b) => {
    switch (sort) {
      case "rating-desc": return parseFloat(b.rating) - parseFloat(a.rating);
      case "price-asc": return parsePrice(a.price) - parsePrice(b.price);
      case "price-desc": return parsePrice(b.price) - parsePrice(a.price);
      case "name-asc": return a.name.localeCompare(b.name);
      default: return 0;
    }
  });

  renderResults(filtered, `Hotels in ${city}`);
}

// ─── AI Recommendation ───
function getAIRecommendation() {
  const city = document.getElementById("cityInput").value.trim();
  const budget = document.getElementById("budgetInput").value;
  const preference = document.getElementById("preference").value;

  if (!city) {
    showToast("Enter a destination for AI recommendation", "error");
    return;
  }

  showSkeletons(1);
  switchView("explore");

  fetch("/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ city, budget, preference })
  })
    .then(res => res.json())
    .then(data => {
      if (!data.hotel || !data.hotel.name) {
        document.getElementById("results-header").style.display = "none";
        document.getElementById("results").innerHTML = `
          <div class="empty-state">
            <h3>No match found</h3>
            <p>Try increasing your budget or choosing a different travel style.</p>
          </div>
        `;
        return;
      }

      currentHotels = [data.hotel];
      document.getElementById("results").innerHTML =
        renderHotelCard(data.hotel, 0, { showCompare: false, isAI: true, isBest: true });

      document.getElementById("results-header").style.display = "flex";
      document.getElementById("results-title").textContent = `AI Pick for ${city}`;
      document.getElementById("results-count").textContent = data.reason || "Personalized recommendation";

      const banner = document.createElement("div");
      banner.className = "ai-banner";
      banner.style.gridColumn = "1 / -1";
      banner.innerHTML = `
        <div class="ai-banner-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.57-3.25 3.92L12 22l-.75-12.08A4.001 4.001 0 0 1 12 2z"/>
          </svg>
        </div>
        <div>
          <h3>Why this hotel?</h3>
          <p>${escapeHtml(data.reason)}</p>
        </div>
      `;
      document.getElementById("results").prepend(banner);
    })
    .catch(() => showToast("Recommendation failed", "error"));
}

// ─── Compare ───
function toggleCompare(index) {
  const hotel = currentHotels[index];
  if (!hotel) return;

  const exists = selectedHotels.find(h => h.name === hotel.name);

  if (exists) {
    selectedHotels = selectedHotels.filter(h => h.name !== hotel.name);
  } else {
    if (selectedHotels.length >= 2) {
      showToast("You can compare up to 2 hotels", "error");
      document.querySelectorAll(".compare-check input").forEach(cb => {
        const card = cb.closest(".hotel-card");
        const idx = parseInt(card?.dataset.index, 10);
        if (idx === index) cb.checked = false;
      });
      return;
    }
    selectedHotels.push(hotel);
    showToast(`${hotel.name} added to compare`, "info");
  }

  updateCompareCount();
  applySortFilter();
}

function updateCompareCount() {
  const badge = document.getElementById("compare-count");
  if (badge) badge.textContent = selectedHotels.length;
  const btn = document.getElementById("compare-btn");
  if (btn) btn.disabled = selectedHotels.length !== 2;
}

function renderCompareSelection() {
  const container = document.getElementById("compare-selection");
  const slots = [0, 1].map(i => {
    const hotel = selectedHotels[i];
    if (hotel) {
      return `
        <div class="compare-slot filled">
          <h4>${escapeHtml(hotel.name)}</h4>
          <p style="color:var(--text-muted);font-size:0.85rem">${escapeHtml(hotel.address)}</p>
          <p style="margin-top:8px;font-weight:600">${escapeHtml(hotel.price)} · ⭐ ${hotel.rating}</p>
        </div>
      `;
    }
    return `
      <div class="compare-slot">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.3">
          <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/>
        </svg>
        <span>Slot ${i + 1} — Select from search results</span>
      </div>
    `;
  });
  container.innerHTML = slots.join("");
  updateCompareCount();
}

function compareHotels() {
  if (selectedHotels.length !== 2) {
    showToast("Select exactly 2 hotels to compare", "error");
    return;
  }

  const [h1, h2] = selectedHotels;

  function score(hotel) {
    const rating = parseFloat(hotel.rating);
    const price = parsePrice(hotel.price);
    return rating * 10 - price / 1000;
  }

  const s1 = score(h1);
  const s2 = score(h2);
  const best = s1 >= s2 ? h1 : h2;

  document.getElementById("compare-results").innerHTML = `
    <div class="compare-winner">🏆 ${escapeHtml(best.name)} offers the best value score</div>
    <div class="compare-grid">
      ${renderHotelCard(h1, 0, { showCompare: false, isBest: best.name === h1.name })}
      ${renderHotelCard(h2, 1, { showCompare: false, isBest: best.name === h2.name })}
    </div>
  `;
}

// ─── Favorites ───
function saveFavoriteByIndex(index) {
  const hotel = currentHotels[index];
  if (!hotel) return;
  saveFavorite(hotel);
}

function saveFavorite(hotel) {
  let favorites = JSON.parse(localStorage.getItem("favorites")) || [];

  if (favorites.find(h => h.name === hotel.name)) {
    showToast("Already in saved hotels", "info");
    return;
  }

  favorites.push(hotel);
  localStorage.setItem("favorites", JSON.stringify(favorites));
  showToast(`${hotel.name} saved`, "success");
  updateFavCount();
  applySortFilter();
}

function removeFavorite(name) {
  let favorites = JSON.parse(localStorage.getItem("favorites")) || [];
  favorites = favorites.filter(h => h.name !== name);
  localStorage.setItem("favorites", JSON.stringify(favorites));
  showToast("Removed from saved", "info");
  updateFavCount();
  loadFavorites();
}

function updateFavCount() {
  const favorites = JSON.parse(localStorage.getItem("favorites")) || [];
  const badge = document.getElementById("fav-count");
  if (badge) badge.textContent = favorites.length;
}

function loadFavorites() {
  const favDiv = document.getElementById("favorites");
  const favorites = JSON.parse(localStorage.getItem("favorites")) || [];

  if (favorites.length === 0) {
    favDiv.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">♥</div>
        <h3>No saved hotels yet</h3>
        <p>Save hotels from search results to build your shortlist.</p>
      </div>
    `;
    return;
  }

  favDiv.innerHTML = favorites.map((hotel, i) =>
    renderHotelCard(hotel, i, { showCompare: false, showRemove: true })
  ).join("");
}

// ─── City Suggestions ───
function showSuggestions() {
  const query = document.getElementById("cityInput").value.toLowerCase();
  const box = document.getElementById("suggestions");

  if (!query) {
    hideSuggestions();
    return;
  }

  const load = allCities.length
    ? Promise.resolve(allCities)
    : fetch("/get_cities").then(r => r.json()).then(c => { allCities = c; return c; });

  load.then(cities => {
    const filtered = cities.filter(c => c.toLowerCase().includes(query)).slice(0, 8);
    activeSuggestionIndex = -1;

    if (!filtered.length) {
      hideSuggestions();
      return;
    }

    box.innerHTML = filtered.map((city, i) =>
      `<div class="suggestion-item" data-index="${i}" onclick="selectCity('${escapeHtml(city).replace(/'/g, "\\'")}')">${escapeHtml(city)}</div>`
    ).join("");
    box.classList.add("visible");
  });
}

function hideSuggestions() {
  const box = document.getElementById("suggestions");
  box.innerHTML = "";
  box.classList.remove("visible");
  activeSuggestionIndex = -1;
}

function selectCity(city) {
  document.getElementById("cityInput").value = city;
  hideSuggestions();
}

function handleSuggestionKey(e) {
  const box = document.getElementById("suggestions");
  const items = box.querySelectorAll(".suggestion-item");
  if (!items.length) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeSuggestionIndex = Math.min(activeSuggestionIndex + 1, items.length - 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeSuggestionIndex = Math.max(activeSuggestionIndex - 1, 0);
  } else if (e.key === "Enter" && activeSuggestionIndex >= 0) {
    e.preventDefault();
    items[activeSuggestionIndex].click();
    return;
  } else if (e.key === "Escape") {
    hideSuggestions();
    return;
  } else {
    return;
  }

  items.forEach((item, i) => item.classList.toggle("active", i === activeSuggestionIndex));
}
