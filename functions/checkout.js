// functions/checkout.js
// Cloudflare Pages Function (Edge): create a Stripe Checkout Session via REST API (no Stripe SDK)

// ✅ SECURITY: Only allow THESE Stripe Price IDs (prevents price tampering)
const ALLOWED_PRICES = new Set([
  "price_1SisR9RsV1vNh8uNeSx6PUq0", // Matcha (single)
  "price_1SisVwRsV1vNh8uNNA5g86vb", // Matcha 6-pack
  "price_1SishaRsV1vNh8uNZVzRQvMd", // Protein Bread (Plain)
  "price_1SisjCRsV1vNh8uNzdxJ7pFR", // Protein Bread (Seeded)
]);

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

  // ✅ Origin-safe URLs (works on pages.dev previews + prod)
  const origin = new URL(request.url).origin;

  // Validate + sanitize
  const valid = [];
  for (const item of items) {
    const price = typeof item?.price === "string" ? item.price : "";
    const qty = Number(item?.qty);

    // ✅ SECURITY: only allow known Stripe price IDs
    if (!ALLOWED_PRICES.has(price)) continue;

    if (!Number.isFinite(qty) || qty <= 0) continue;

    valid.push({ price, qty: Math.floor(qty) });
  }

  if (valid.length === 0) {
    return new Response(
      JSON.stringify({ error: "No valid items provided." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Stripe expects application/x-www-form-urlencoded for this endpoint
  const params = new URLSearchParams();
  params.append("mode", "payment");
  params.append("success_url", `${origin}/success/`);
  params.append("cancel_url", `${origin}/products/`);
  params.append("shipping_address_collection[allowed_countries][]", "NZ");

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
