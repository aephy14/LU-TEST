// /js/cart.js
// LumaFood cart + Stripe Checkout (Cloudflare Pages Functions)
// Expects backend endpoint: POST /checkout
// Expects body shape: { items: [{ price: "price_...", qty: 1 }, ...] }

(() => {
  const CART_KEY = "luma_cart_v1";

  const cartItemsEl = document.getElementById("cartItems");
  const cartTotalEl = document.getElementById("cartTotal");
  const cartMsgEl = document.getElementById("cartMsg");
  const clearBtn = document.getElementById("clearCartBtn");
  const checkoutBtn = document.getElementById("checkoutBtn");

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

  function render() {
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
      left.innerHTML = `<div style="font-weight:800;">${escapeHtml(
        item.label || "Item"
      )}</div>`;

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.alignItems = "center";
      right.style.gap = "8px";

      const minus = document.createElement("button");
      minus.className = "btn";
      minus.type = "button";
      minus.textContent = "−";
      minus.addEventListener("click", () => setQty(item.priceId, (item.qty || 0) - 1));

      const qty = document.createElement("div");
      qty.style.minWidth = "26px";
      qty.style.textAlign = "center";
      qty.style.fontWeight = "800";
      qty.textContent = String(item.qty || 0);

      const plus = document.createElement("button");
      plus.className = "btn";
      plus.type = "button";
      plus.textContent = "+";
      plus.addEventListener("click", () => setQty(item.priceId, (item.qty || 0) + 1));

      right.appendChild(minus);
      right.appendChild(qty);
      right.appendChild(plus);

      row.appendChild(left);
      row.appendChild(right);
      cartItemsEl.appendChild(row);
    });

    cartTotalEl.textContent = "Total calculated at checkout";
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

  // ✅ Stripe Checkout (Cloudflare Pages Function)
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

      // Read once, then parse (prevents "unexpected end of data" surprises)
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.error("[cart.js] /checkout non-JSON response:", text);
        throw new Error("Checkout returned non-JSON response.");
      }

      if (!res.ok) {
        throw new Error(data?.error || "Checkout failed.");
      }
      if (!data?.url) {
        throw new Error("Checkout returned no URL.");
      }

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

  render();

  // Helpers
  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
