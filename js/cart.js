(function(){
  const CART_KEY = "luma_cart_v1";

  const cartItemsEl = document.getElementById("cartItems");
  const cartTotalEl = document.getElementById("cartTotal");
  const cartMsgEl = document.getElementById("cartMsg");
  const clearBtn = document.getElementById("clearCartBtn");
  const checkoutBtn = document.getElementById("checkoutBtn");

  function loadCart(){
    try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
    catch { return []; }
  }

  function saveCart(cart){
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  function addToCart(priceId, label){
    const cart = loadCart();
    const found = cart.find(i => i.priceId === priceId);
    if(found) found.qty += 1;
    else cart.push({ priceId, label, qty: 1 });
    saveCart(cart);
    render();
  }

  function setQty(priceId, qty){
    let cart = loadCart();
    cart = cart.map(i => i.priceId === priceId ? ({...i, qty}) : i).filter(i => i.qty > 0);
    saveCart(cart);
    render();
  }

  function clearCart(){
    saveCart([]);
    render();
  }

  function render(){
    const cart = loadCart();

    if(!cartItemsEl || !cartTotalEl) return;

    cartItemsEl.innerHTML = "";
    cartMsgEl.textContent = "";
    cartMsgEl.className = "newsletter-msg";

    if(cart.length === 0){
      cartItemsEl.innerHTML = `<div style="opacity:.8;">Your cart is empty.</div>`;
      cartTotalEl.textContent = "Total: —";
      return;
    }

    cart.forEach(item => {
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
      left.innerHTML = `<div style="font-weight:800;">${item.label}</div>`;

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.alignItems = "center";
      right.style.gap = "8px";

      const minus = document.createElement("button");
      minus.className = "btn";
      minus.type = "button";
      minus.textContent = "−";
      minus.addEventListener("click", () => setQty(item.priceId, item.qty - 1));

      const qty = document.createElement("div");
      qty.style.minWidth = "26px";
      qty.style.textAlign = "center";
      qty.style.fontWeight = "800";
      qty.textContent = String(item.qty);

      const plus = document.createElement("button");
      plus.className = "btn";
      plus.type = "button";
      plus.textContent = "+";
      plus.addEventListener("click", () => setQty(item.priceId, item.qty + 1));

      right.appendChild(minus);
      right.appendChild(qty);
      right.appendChild(plus);

      row.appendChild(left);
      row.appendChild(right);
      cartItemsEl.appendChild(row);
    });

    cartTotalEl.textContent = "Total calculated at checkout";
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".add-to-cart");
    if(!btn) return;

    const priceId = btn.getAttribute("data-price");
    const label = (btn.textContent || "Item").trim();

    if(!priceId){
      alert("Missing data-price on this button.");
      return;
    }

    addToCart(priceId, label);
  });

  clearBtn?.addEventListener("click", clearCart);

  checkoutBtn?.addEventListener("click", async () => {
    const cart = loadCart();
    if(cart.length === 0){
      cartMsgEl.textContent = "Cart is empty.";
      cartMsgEl.classList.add("err");
      return;
    }

    checkoutBtn.disabled = true;

    try{
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map(i => ({ price: i.priceId, quantity: i.qty }))
        })
      });

      const data = await res.json();
      if(!res.ok || !data.url) throw new Error("Checkout failed");

      window.location.href = data.url;
    }catch(err){
      cartMsgEl.textContent = err.message || "Checkout error.";
      cartMsgEl.classList.add("err");
    }finally{
      checkoutBtn.disabled = false;
    }
  });

  render();
})();