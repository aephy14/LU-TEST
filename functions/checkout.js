import Stripe from "stripe";

export async function onRequestPost({ request, env }) {
  if (!env?.STRIPE_SECRET_KEY) {
    return new Response(
      JSON.stringify({ error: "Missing STRIPE_SECRET_KEY in environment variables." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
  });

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

  // Validate + sanitize
  const line_items = [];
  for (const item of items) {
    const price = typeof item?.price === "string" ? item.price : "";
    const qty = Number(item?.qty);

    if (!price.startsWith("price_")) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;

    line_items.push({
      price,
      quantity: Math.floor(qty),
    });
  }

  if (line_items.length === 0) {
    return new Response(
      JSON.stringify({ error: "No valid items provided." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      success_url: "https://lumafood.com/success/",
      cancel_url: "https://lumafood.com/products/",
      shipping_address_collection: {
        allowed_countries: ["NZ"],
      },
      // Optional but useful:
      // billing_address_collection: "required",
      // allow_promotion_codes: true,
    });

    return new Response(JSON.stringify({ url: session.url }), {
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
