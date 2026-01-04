// functions/checkout.js
// Cloudflare Pages Function (Edge): create a Stripe Checkout Session via REST API (no Stripe SDK)

// ✅ SECURITY: Only allow THESE Stripe Price IDs (prevents price tampering)
const ALLOWED_PRICES = new Set([
  "price_1SisR9RsV1vNh8uNeSx6PUq0", // Matcha (single)
  "price_1SisVwRsV1vNh8uNNA5g86vb", // Matcha 6-pack
  "price_1SishaRsV1vNh8uNZVzRQvMd", // Protein Bread (Plain)
  "price_1SisjCRsV1vNh8uNzdxJ7pFR", // Protein Bread (Seeded)
]);

// ✅ SHIPPING: Stripe Shipping Rate IDs
const SHIPPING_RATES = {
  AKL: "shr_1Sln0KRsV1vNh8uNs1rfjefv", // Auckland shipping (free)
  NZ:  "shr_1Sln1ZRsV1vNh8uNWX3NC8o8", // Rest of NZ shipping (paid)
};

// ✅ Limits (basic abuse prevention)
const MAX_DISTINCT_ITEMS = 12;     // number of different line items
const MAX_QTY_PER_ITEM = 24;       // max qty per line item
const MAX_TOTAL_QTY = 60;          // max total qty across cart

export async function onRequestPost({ request, env }) {
  if (!env?.STRIPE_SECRET_KEY) {
    return new Response(
      JSON.stringify({ error: "Missing STRIPE_SECRET_KEY in environment variables." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const items = Array.isArray(body?.items) ? body.items : null;
  if (!items || items.length === 0) {
    return new Response(
      JSON.stringify({ error: "No items provided." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (items.length > MAX_DISTINCT_ITEMS) {
    return new Response(
      JSON.stringify({ error: `Too many different items. Max ${MAX_DISTINCT_ITEMS}.` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // ✅ Origin-safe URLs (works on pages.dev previews + prod)
  const origin = new URL(request.url).origin;

  // ✅ HARD GEOFENCE: only allow NZ checkout (even if someone tries to pass other data)
  // (Stripe will also enforce via shipping_address_collection, this is just extra defense.)
  if (body?.country && String(body.country).toUpperCase() !== "NZ") {
    return new Response(
      JSON.stringify({ error: "We currently only ship within New Zealand (NZ)." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

// ✅ Shipping zone (must be explicitly chosen on site)
// Expected: "AKL" or "NZ"
const shippingZoneRaw =
  typeof body?.shipping_zone === "string"
    ? body.shipping_zone.trim().toUpperCase()
    : "";

// ✅ IMPORTANT: do NOT default to NZ — force user choice
if (shippingZoneRaw !== "AKL" && shippingZoneRaw !== "NZ") {
  return new Response(
    JSON.stringify({ error: "Choose a delivery option: shipping_zone must be 'AKL' or 'NZ'." }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
}

const shippingZone = shippingZoneRaw;
const shippingRateId = SHIPPING_RATES[shippingZone];

  if (!shippingRateId) {
    return new Response(
      JSON.stringify({ error: "Shipping rate not configured for that zone." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Validate + sanitize
  const valid = [];
  let totalQty = 0;

  for (const item of items) {
    const price = typeof item?.price === "string" ? item.price : "";
    const qtyNum = Number(item?.qty);

    // ✅ SECURITY: only allow known Stripe price IDs
    if (!ALLOWED_PRICES.has(price)) continue;

    if (!Number.isFinite(qtyNum) || qtyNum <= 0) continue;

    const qty = Math.floor(qtyNum);
    const clampedQty = Math.min(qty, MAX_QTY_PER_ITEM);

    totalQty += clampedQty;
    valid.push({ price, qty: clampedQty });
  }

  if (valid.length === 0) {
    return new Response(
      JSON.stringify({ error: "No valid items provided." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (totalQty > MAX_TOTAL_QTY) {
    return new Response(
      JSON.stringify({ error: `Cart too large. Max total quantity is ${MAX_TOTAL_QTY}.` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Stripe expects application/x-www-form-urlencoded for this endpoint
  const params = new URLSearchParams();
  params.append("mode", "payment");
  params.append("success_url", `${origin}/success/`);
  params.append("cancel_url", `${origin}/products/`);

  // ✅ Restrict shipping to NZ only
  params.append("shipping_address_collection[allowed_countries][]", "NZ");

  // ✅ Use exactly ONE shipping option based on shipping_zone
  params.append("shipping_options[0][shipping_rate]", shippingRateId);

  // Helpful metadata (visible in Stripe dashboard)
  params.append("metadata[shipping_zone]", shippingZone);

  // Optional settings (uncomment if you want)
  // params.append("billing_address_collection", "required");
  // params.append("allow_promotion_codes", "true");

  valid.forEach((item, i) => {
    params.append(`line_items[${i}][price]`, item.price);
    params.append(`line_items[${i}][quantity]`, String(item.qty));
  });

  try {
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await res.json();

    if (!res.ok || !data?.url) {
      return new Response(
        JSON.stringify({
          error: "Failed to create Stripe Checkout session.",
          detail: data?.error?.message || JSON.stringify(data),
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ url: data.url }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Failed to create Stripe Checkout session.",
        detail: String(err?.message || err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
