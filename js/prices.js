// /js/prices.js
// Fetch Stripe prices from Cloudflare Pages Function and inject into the UI.

(() => {
  // ✅ Your Pages Function is at: /prices  (because file is functions/prices.js)
  const PRICES_ENDPOINT = "/prices";

  // Optional: format currency nicely
  function fmt(amount, currency) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return `- ${currency || "NZD"}`;
    try {
      return new Intl.NumberFormat("en-NZ", {
        style: "currency",
        currency: (currency || "NZD").toUpperCase(),
      }).format(n);
    } catch {
      return `${n.toFixed(2)} ${(currency || "NZD").toUpperCase()}`;
    }
  }

  async function loadPrices() {
    const res = await fetch(PRICES_ENDPOINT, { cache: "no-store" });
    if (!res.ok) throw new Error(`Prices endpoint failed: ${res.status}`);
    return await res.json(); // { priceId: { amount: "12.00", currency: "NZD" }, ... }
  }

  function applyPrices(prices) {
    // You have buttons like: <button class="btn add-to-cart" data-price="price_...">
    // We will look for a sibling element: [data-price-label] OR inject one just before the button.
    const buttons = document.querySelectorAll(".add-to-cart[data-price]");
    buttons.forEach((btn) => {
      const priceId = btn.getAttribute("data-price");
      const p = prices?.[priceId];

      // Find existing label in same CTA row
      const cta = btn.closest(".ctaRow");
      let label = cta?.querySelector("[data-price-label]");

      // If not present, create it to the left of the button
      if (!label && cta) {
        label = document.createElement("div");
        label.setAttribute("data-price-label", "true");
        label.style.fontWeight = "900";
        label.style.letterSpacing = ".02em";
        label.style.color = "rgba(255,255,255,.92)";
        label.style.padding = "10px 12px";
        label.style.borderRadius = "999px";
        label.style.border = "1px solid rgba(255,255,255,.18)";
        label.style.background = "rgba(0,0,0,.22)";
        label.style.backdropFilter = "blur(10px)";
        label.style.whiteSpace = "nowrap";

        // Ensure CTA row lays out nicely
        cta.style.justifyContent = "space-between";
        cta.style.gap = "10px";

        cta.prepend(label);
      }

      if (!label) return;

      if (!p) {
        label.textContent = "- NZD";
        return;
      }

      label.textContent = fmt(p.amount, p.currency);
    });
  }

  // Run after DOM is ready
  window.addEventListener("DOMContentLoaded", async () => {
    try {
      const prices = await loadPrices();
      applyPrices(prices);
    } catch (e) {
      // Keep placeholders; also log so you can debug in console
      console.warn("[prices.js] Failed to load/apply prices:", e);
    }
  });
})();
