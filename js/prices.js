// /js/prices.js
// Fetch Stripe prices from Cloudflare Pages Function (/prices) and inject into the UI.

(() => {
  const PRICES_ENDPOINT = "/prices";

  function fmt(amount, currency) {
    const n = Number(amount);
    const cur = (currency || "NZD").toUpperCase();

    if (!Number.isFinite(n)) return `— ${cur}`;

    try {
      return new Intl.NumberFormat("en-NZ", {
        style: "currency",
        currency: cur,
      }).format(n);
    } catch {
      return `${n.toFixed(2)} ${cur}`;
    }
  }

  async function loadPrices() {
    const res = await fetch(PRICES_ENDPOINT, { cache: "no-store" });
    if (!res.ok) throw new Error(`Prices endpoint failed: ${res.status}`);
    return await res.json(); // { priceId: { amount:"12.00", currency:"NZD" }, ... }
  }

  function applyPrices(prices) {
    // Update existing price elements in your HTML:
    // <div class="price" data-price-id="price_...">— <small>NZD</small></div>
    const els = document.querySelectorAll(".price[data-price-id]");

    els.forEach((el) => {
      const priceId = el.getAttribute("data-price-id");
      const p = prices?.[priceId];

      if (!p) {
        el.innerHTML = `— <small>NZD</small>`;
        return;
      }

      // Keep your <small> currency styling
      const cur = (p.currency || "NZD").toUpperCase();
      const formatted = fmt(p.amount, cur);

      // If Intl already includes currency symbol, we still show the 3-letter code in <small>
      // Example: "$12.00" + "NZD"
      const numberOnly = formatted.replace(/[A-Z]{3}\s*$/i, "").trim();
      el.innerHTML = `${numberOnly} <small>${cur}</small>`;
    });
  }

  window.addEventListener("DOMContentLoaded", async () => {
    try {
      const prices = await loadPrices();
      applyPrices(prices);
    } catch (e) {
      console.warn("[prices.js] Failed to load/apply prices:", e);
      // leave the placeholders in place
    }
  });
})();
