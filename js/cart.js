// /js/cart.js
// LumaFood cart + Stripe Checkout (Cloudflare Pages Functions)
// Uses GET /prices to calculate totals in-cart
// POST /checkout expects: { items: [{ price: "price_...", qty: 1 }, ...] }

(() => {
  const CART_KEY = "luma_cart_v1";

  const cartItemsEl = document.getElementById("cartItems");
  const cartTotalEl = document.getElementById("cartTotal");
  const cartMsgEl = document.getElementById("cartMsg");
  const clearBtn = document.getElementById("clearCartBtn");
  const checkoutBtn = document.getElementById("checkoutBtn");

  // priceId -> { amount: "26.00", currency: "NZD" }
  let PRICE_MAP = null; // null = not loaded yet
  let PRICE_MAP_LOADING = null;

  function loadCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
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

  async function ensurePricesLoaded() {
    if (PRICE_MAP) return PRICE_MAP;
    if (PRICE_MAP_LOADING) return PRICE_MAP_LOADING;

    PRICE_MAP_LOADING = (async () => {
      try {
        const res = await fetch("/prices", { headers: { "Accept": "application/json" } });
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          console.error("[cart.js] /prices returned non-JSON:", text);
          return null;
        }

        if (!res.ok) {
          console.error("[cart.js] /prices error:", data);
          return null;
        }

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
    // amount is number in major units (e.g. 26.00)
    try {
      return new Intl.NumberFormat("en-NZ", { style: "currency", currency }).format(amount);
    } catch {
      // fallback
      return `${currency} ${amount.toFixed(2)}`;
    }
  }

  async function render() {
    const cart = loadCart();

    if (!cartItemsEl || !cartTotalEl) return;

    cartItemsEl.innerHTML = "";
    if (cartMsgEl) {
      cartMsgEl.textContent = "";
      cartMsgEl.className = "newsletter-msg";
    }

    if (cart.length === 0) {
      cartItemsEl.innerHTML = `<div style="opacity:.8;">Your cart is empty.</div>`;
      cartTotalEl.textContent = "Total: —";
      return;
    }

    // Try load prices so we can compute totals
    const prices = await ensurePricesLoaded();

    // Determine currency (default NZD)
    let currency = "NZD";
    if (prices) {
      for (const item of cart) {
        const p = prices[item.priceId];
        if (p && p.currency) {
          currency = String(p.currency).toUpperCase();
          break;
        }
      }
    }

    let subtotal = 0;
    let missingCount = 0;

    cart.forEach((item) => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.gap = "10px";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
      row.style.border = "1px solid rgba(171,163,241,.14)";
      row.style.background = "rgba(0,0,0,.10)";
      row.style.borderRadius = "14px";
      row.style.padding = "10px 12px";

      const left = document.createElement("div");
      left.style.display = "grid";
      left.style.gap = "6px";

      const title = document.createElement("div");
      title.style.fontWeight = "800";
      title.textContent = item.label || "Item";

      // Line price (if we have it)
      const lineMeta = document.createElement("div");
      lineMeta.style.opacity = ".82";
      lineMeta.style.fontSize = "13px";

      const p = prices ? prices[item.priceId] : null;
      const qty = Number(item.qty || 0);

      if (p && p.amount != null) {
        const unit = Number(p.amount);
        if (!Number.isNaN(unit)) {
          const line = unit * qty;
          subtotal += line;
          lineMeta.textContent = `${fmtMoney(unit, currency)} each • Line: ${fmtMoney(line, currency)}`;
        } else {
          missingCount += 1;
          lineMeta.textContent = "Price unavailable";
        }
      } else {
        missingCount += 1;
        lineMeta.textContent = "Price unavailable";
      }

      left.appendChild(title);
      left.appendChild(lineMeta);

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.alignItems = "center";
      right.style.gap = "8px";

      const minus = document.createElement("button");
      minus.className = "btn";
      minus.type = "button";
      minus.textContent = "−";
      minus.addEventListener("click", () => setQty(item.priceId, (item.qty || 0) - 1));

      const qtyEl = document.createElement("div");
      qtyEl.style.minWidth = "26px";
      qtyEl.style.textAlign = "center";
      qtyEl.style.fontWeight = "800";
      qtyEl.textContent = String(qty);

      const plus = document.createElement("button");
      plus.className = "btn";
      plus.type = "button";
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
        cartMsgEl.textContent = "Couldn’t load prices. Total will be calculated at checkout.";
        cartMsgEl.classList.add("err");
      }
      return;
    }

    if (missingCount > 0) {
      cartTotalEl.textContent = `Subtotal: ${fmtMoney(subtotal, currency)} (some items missing prices)`;
    } else {
      cartTotalEl.textContent = `Subtotal: ${fmtMoney(subtotal, currency)}`;
    }
  }

  // Add-to-cart buttons anywhere on page:
  // <button class="btn add-to-cart" data-price="price_...">Add ...</button>
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".add-to-cart");
    if (!btn) return;

    const priceId = btn.getAttribute("data-price");
    const label = (btn.textContent || "Item").trim();

    if (!priceId) {
      alert("Missing data-price on this button.");
      return;
    }

    addToCart(priceId, label);
  });

  clearBtn?.addEventListener("click", clearCart);

  // Stripe Checkout (Cloudflare Pages Function)
  checkoutBtn?.addEventListener("click", async () => {
    const cart = loadCart();
    if (cart.length === 0) {
      if (cartMsgEl) {
        cartMsgEl.textContent = "Cart is empty.";
        cartMsgEl.classList.add("err");
      }
      return;
    }

    checkoutBtn.disabled = true;

    try {
      const res = await fetch("/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((i) => ({ price: i.priceId, qty: i.qty })),
        }),
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
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

  // Initial render
  render();
})();
