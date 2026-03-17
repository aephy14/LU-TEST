// /js/cart.js
// LumaFood cart + Stripe Checkout (Cloudflare Pages Functions)
// Shipping auto-detected from NZ postcode: Auckland $8, Rest of NZ $15

(() => {
  const CART_KEY     = "luma_cart_v1";
  const REFERRAL_KEY = "luma_ref_v1";
  const POSTCODE_KEY = "luma_postcode_v1";
  const ZONE_KEY     = "luma_zone_v1";

    let postcodeRestored = false;

  // Read referral code from URL ?ref=... and persist
  (() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref) localStorage.setItem(REFERRAL_KEY, ref.trim().toUpperCase());
    } catch {}
  })();

  const cartItemsEl = document.getElementById("cartItems");
  const cartTotalEl = document.getElementById("cartTotal");
  const cartMsgEl   = document.getElementById("cartMsg");
  const clearBtn    = document.getElementById("clearCartBtn");
  const checkoutBtn = document.getElementById("checkoutBtn");

  // ── Postcode → zone detection ─────────────────────────────────────────
  function detectZone(postcode) {
    const digits = String(postcode).replace(/\D/g, "");
    if (digits.length !== 4) return null;
    const n = parseInt(digits, 10);
    const isAkl = (
      (n >= 200  && n <= 299)  ||
      (n >= 500  && n <= 599)  ||
      (n >= 600  && n <= 699)  ||
      (n >= 700  && n <= 799)  ||
      (n >= 800  && n <= 899)  ||
      (n >= 900  && n <= 999)  ||
      (n >= 1010 && n <= 1072) ||
      (n >= 2010 && n <= 2025) ||
      (n >= 2102 && n <= 2120) ||
      (n >= 2571 && n <= 2580)
    );
    return isAkl ? "AKL" : "NZ";
  }

  function getSavedZone() {
    try { return localStorage.getItem(ZONE_KEY) || ""; } catch { return ""; }
  }

  // ── Cart storage ──────────────────────────────────────────────────────

    let _memCart = null;

  function saveCart(cart) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
      _memCart = null;
    } catch {
      _memCart = cart;
    }
  }

  function loadCart() {
    if (_memCart !== null) return _memCart;
    try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
    catch { return []; }
  }


  function addToCart(priceId, label) {
    const cart = loadCart();
    const found = cart.find((i) => i.priceId === priceId);
    if (found) found.qty += 1;
    else cart.push({ priceId, label, qty: 1 });
    saveCart(cart);
    render();
  }

  function setQty(priceId, qty) {
    let cart = loadCart();
    cart = cart
      .map((i) => (i.priceId === priceId ? { ...i, qty } : i))
      .filter((i) => (i.qty || 0) > 0);
    saveCart(cart);
    render();
  }

  function clearCart() {
    saveCart([]);
    render();
  }

  // ── Prices ────────────────────────────────────────────────────────────
  let PRICE_MAP = null;
  let PRICE_MAP_LOADING = null;

  async function ensurePricesLoaded() {
    if (PRICE_MAP) return PRICE_MAP;
    if (PRICE_MAP_LOADING) return PRICE_MAP_LOADING;
    PRICE_MAP_LOADING = (async () => {
      try {
        const res  = await fetch("/prices", { headers: { "Accept": "application/json" } });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); }
        catch {
          console.error("[cart.js] /prices returned non-JSON:", text);
          return null;
        }
        if (!res.ok) { console.error("[cart.js] /prices error:", data); return null; }
        PRICE_MAP = data && typeof data === "object" ? data : null;
        return PRICE_MAP;
      } catch (e) {
        console.error("[cart.js] /prices fetch failed:", e);
        return null;
      } finally {
        PRICE_MAP_LOADING = null;
      }
    })();
    return PRICE_MAP_LOADING;
  }

  function fmtMoney(amount, currency) {
    try {
      return new Intl.NumberFormat("en-NZ", { style: "currency", currency }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  }

  // ── Shipping display ──────────────────────────────────────────────────
    function updateShippingDisplay(subtotal, currency) {
    const el   = document.getElementById("shippingCostDisplay");
    const hint = document.getElementById("aklPromoHint");
    if (!el) return;
    const zone = getSavedZone();
    if (!zone) {
      el.textContent = "";
      if (hint) hint.style.display = "none";
      return;
    }
    if (subtotal >= 60) {
      el.textContent = "🎉 Free shipping!";
      el.style.color = "#5ecb3e";
      if (hint) hint.style.display = "none";
    } else if (zone === "AKL") {
      el.textContent = `Auckland — ${fmtMoney(8, currency)}`;
      el.style.color = "";
      if (hint) hint.style.display = "block";
    } else {
      el.textContent = `NZ excl Auckland — ${fmtMoney(15, currency)}`;
      el.style.color = "";
      if (hint) hint.style.display = "none";
    }
  }

  // ── Render ────────────────────────────────────────────────────────────
  async function render() {
    const cart = loadCart();
    if (!cartItemsEl || !cartTotalEl) return;

    cartItemsEl.innerHTML = "";
    if (cartMsgEl) {
      cartMsgEl.textContent = "";
      cartMsgEl.className = "newsletter-msg";
    }

    const shippingSection = document.getElementById("shippingSection");
    const postcodeInputEl = document.getElementById("postcodeInput");

    if (cart.length === 0) {
      cartItemsEl.innerHTML   = `<div style="opacity:.8;">Your cart is empty.</div>`;
      cartTotalEl.textContent = "Total: —";
      if (shippingSection) shippingSection.style.display = "none";
      return;
    }

    if (shippingSection) shippingSection.style.display = "block";
   if (postcodeInputEl && !postcodeRestored) {
      try {
        const saved = localStorage.getItem(POSTCODE_KEY) || "";
        if (saved) postcodeInputEl.value = saved;
      } catch {}
      postcodeRestored = true;
    }

    const prices = await ensurePricesLoaded();

    let currency = "NZD";
    if (prices) {
      for (const item of cart) {
        const p = prices[item.priceId];
        if (p?.currency) { currency = String(p.currency).toUpperCase(); break; }
      }
    }

    let subtotal     = 0;
    let missingCount = 0;

    cart.forEach((item) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex; gap:10px; align-items:center; justify-content:space-between; border:1px solid rgba(171,163,241,.14); background:rgba(0,0,0,.10); border-radius:14px; padding:10px 12px;";

      const left = document.createElement("div");
      left.style.cssText = "display:grid; gap:6px;";

      const title = document.createElement("div");
      title.style.fontWeight = "800";
      title.textContent = item.label || "Item";

      const lineMeta = document.createElement("div");
      lineMeta.style.cssText = "opacity:.82; font-size:13px;";

      const p   = prices ? prices[item.priceId] : null;
      const qty = Number(item.qty || 0);

      if (p && p.amount != null) {
        const unit = Number(p.amount);
        if (!Number.isNaN(unit)) {
          const line  = unit * qty;
          subtotal   += line;
          lineMeta.textContent = `${fmtMoney(unit, currency)} each • Line: ${fmtMoney(line, currency)}`;
        } else {
          missingCount++;
          lineMeta.textContent = "Price unavailable";
        }
      } else {
        missingCount++;
        lineMeta.textContent = "Price unavailable";
      }

      left.appendChild(title);
      left.appendChild(lineMeta);

      const right = document.createElement("div");
      right.style.cssText = "display:flex; align-items:center; gap:8px;";

      const minus = document.createElement("button");
      minus.className   = "btn";
      minus.type        = "button";
      minus.textContent = "−";
      minus.addEventListener("click", () => setQty(item.priceId, (item.qty || 0) - 1));

      const qtyEl = document.createElement("div");
      qtyEl.style.cssText   = "min-width:26px; text-align:center; font-weight:800;";
      qtyEl.textContent = String(qty);

      const plus = document.createElement("button");
      plus.className   = "btn";
      plus.type        = "button";
      plus.textContent = "+";
      plus.addEventListener("click", () => setQty(item.priceId, (item.qty || 0) + 1));

      right.appendChild(minus);
      right.appendChild(qtyEl);
      right.appendChild(plus);
      row.appendChild(left);
      row.appendChild(right);
      cartItemsEl.appendChild(row);
    });

    if (!prices) {
      cartTotalEl.textContent = "Total: —";
      if (cartMsgEl) {
        cartMsgEl.textContent = "Couldn't load prices. Total will be calculated at checkout.";
        cartMsgEl.classList.add("err");
      }
      return;
    }

    if (missingCount > 0) {
      cartTotalEl.textContent = `Subtotal: ${fmtMoney(subtotal, currency)} (some items missing prices)`;
    } else {
      const FREE_THRESHOLD = 60;
      if (subtotal >= FREE_THRESHOLD) {
        cartTotalEl.textContent = `Subtotal: ${fmtMoney(subtotal, currency)} 🎉 Free shipping!`;
      } else {
        const remaining = (FREE_THRESHOLD - subtotal).toFixed(2);
        cartTotalEl.textContent = `Subtotal: ${fmtMoney(subtotal, currency)} — $${remaining} away from free shipping`;
      }
    }

    updateShippingDisplay(subtotal, currency);
    renderDiscountBanner(cart);
  }

  // ── Discount banner (24-can bulk) ─────────────────────────────────────
  const CANS_PER_PRICE = {
    "price_1TBqNRRsV1vNh8uNL6zcmdFL": 6,
    "price_1TBqLdRsV1vNh8uNRAY1laKn": 6,
  };

  function renderDiscountBanner(cart) {
    const bannerEl = document.getElementById("discountBanner");
    if (!bannerEl) return;
    let totalCans = 0;
    for (const item of cart) {
      totalCans += (CANS_PER_PRICE[item.priceId] || 0) * (item.qty || 0);
    }
    if (totalCans >= 24) {
      bannerEl.textContent   = "🎉 15% bulk discount applied — you've got 24+ cans!";
      bannerEl.style.color   = "#2d7c1d";
      bannerEl.style.display = "block";
    } else if (totalCans >= 6) {
      const need = 24 - totalCans;
      bannerEl.textContent   = `🧃 Add ${need} more can${need === 1 ? "" : "s"} to unlock 15% off your whole order!`;
      bannerEl.style.color   = "#f5e482";
      bannerEl.style.display = "block";
    } else {
      bannerEl.textContent   = "";
      bannerEl.style.display = "none";
    }
  }

  // ── Postcode input ────────────────────────────────────────────────────
  document.addEventListener("input", (e) => {
    if (e.target.id !== "postcodeInput") return;
    const pc   = e.target.value.trim();
    const zone = detectZone(pc);
    try {
      if (zone) {
        localStorage.setItem(POSTCODE_KEY, pc);
        localStorage.setItem(ZONE_KEY, zone);
      } else {
        localStorage.removeItem(ZONE_KEY);
      }
    } catch {}
    render();
  });

  // ── Add-to-cart buttons ───────────────────────────────────────────────
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".add-to-cart");
    if (!btn) return;
    const priceId = btn.getAttribute("data-price");
    const label   = (btn.textContent || "Item").trim();
    if (!priceId) { alert("Missing data-price on this button."); return; }
    addToCart(priceId, label);
  });

  clearBtn?.addEventListener("click", clearCart);

  // ── Checkout ──────────────────────────────────────────────────────────
  checkoutBtn?.addEventListener("click", async () => {
    const cart = loadCart();
    if (cart.length === 0) {
      if (cartMsgEl) {
        cartMsgEl.textContent = "Cart is empty.";
        cartMsgEl.classList.add("err");
      }
      return;
    }

    const shippingZone = getSavedZone();
    if (!shippingZone) {
      if (cartMsgEl) {
        cartMsgEl.textContent = "Enter your postcode above to continue.";
        cartMsgEl.classList.add("err");
      }
      document.getElementById("postcodeInput")?.focus();
      return;
    }

    checkoutBtn.disabled = true;

    try {
      let referralCode = "";
      try { referralCode = localStorage.getItem(REFERRAL_KEY) || ""; } catch {}

      const res = await fetch("/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items:         cart.map((i) => ({ price: i.priceId, qty: i.qty })),
          shipping_zone: shippingZone,
          referral_code: referralCode || undefined,
        }),
      });

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); }
      catch {
        console.error("[cart.js] /checkout non-JSON response:", text);
        throw new Error("Checkout returned non-JSON response.");
      }

      if (!res.ok) throw new Error(data?.error || "Checkout failed.");
      if (!data?.url) throw new Error("Checkout returned no URL.");

      window.location.href = data.url;
    } catch (err) {
      if (cartMsgEl) {
        cartMsgEl.textContent = String(err?.message || err || "Checkout error.");
        cartMsgEl.classList.add("err");
      }
    } finally {
      checkoutBtn.disabled = false;
    }
  });

  // ── Init ──────────────────────────────────────────────────────────────
  render();
})();
