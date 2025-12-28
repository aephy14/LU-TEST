// /js/prices.js
// Fetch Stripe prices from Cloudflare Pages Function and inject into the UI.

(() => {
  // Pages Function route: /prices  (because file is functions/prices.js)
  const PRICES_ENDPOINT = "/prices";

  // Format currency nicely
  function fmt(amount, currency) {
    const n = Number(amount);
    const c = (currency || "NZD").toUpperCase();
    if (!Number.isFinite(n)) return `—`; // keep placeholder
    try {
      return new Intl.NumberFormat("en-NZ", {
        style: "currency",
        currency: c,
      }).format(n);
    } catch {
      return `${n.toFixed(2)} ${c}`;
    }
  }

  async function loadPrices() {
    const res = await fetch(PRICES_ENDPOINT, { cache: "no-store" });
    if (!res.ok) throw new Error(`Prices endpoint failed: ${res.status}`);
    return await res.json(); // { priceId: { amount: "12.00", currency: "NZD" }, ... }
  }

  function applyPrices(prices) {
    // ✅ New approach:
    // Your HTML has: <div class="price" data-price-id="price_...">— <small>NZD</small></div>
    // Update those directly (no injection).
    const priceEls = document.querySelectorAll(".price[data-price-id]");

    priceEls.forEach((el) => {
      const priceId = el.getAttribute("data-price-id");
      const p = prices?.[priceId];

      // If no price found, keep whatever placeholder is already there
      if (!p) return;

      const currency = (p.currency || "NZD").toUpperCase();
      el.innerHTML = `${fmt(p.amount, currency)} <small>${currency}</small>`;
    });

    // Optional fallback for older markup (if any buttons exist without .price blocks):
    // If you ever remove the .price divs, this still injects a label.
    const buttons = document.querySelectorAll(".add-to-cart[data-price]");
    buttons.forEach((btn) => {
      const cta = btn.closest(".ctaRow");
      if (!cta) return;

      // If a .price already exists, do nothing.
      if (cta.querySelector(".price[data-price-id]")) return;

      const priceId = btn.getAttribute("data-price");
      const p = prices?.[priceId];
      if (!p) return;

      const currency = (p.currency || "NZD").toUpperCase();
      const label = document.createElement("div");
      label.className = "price";
      label.setAttribute("data-price-id", priceId);
      label.innerHTML = `${fmt(p.amount, currency)} <small>${currency}</small>`;
      cta.prepend(label);
    });
  }

  window.addEventListener("DOMContentLoaded", async () => {
    try {
      const prices = await loadPrices();
      applyPrices(prices);
    } catch (e) {
      console.warn("[prices.js] Failed to load/apply prices:", e);
      // Keep placeholders (— NZD) in the HTML
    }
  });
})();
