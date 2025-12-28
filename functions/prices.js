// functions/prices.js
// Cloudflare Pages Function – Edge-compatible Stripe price fetch

export async function onRequestGet({ env }) {
  if (!env?.STRIPE_SECRET_KEY) {
    return new Response(
      JSON.stringify({ error: "Missing STRIPE_SECRET_KEY" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const res = await fetch(
      "https://api.stripe.com/v1/prices?active=true&limit=100",
      {
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }

    const data = await res.json();

    const output = {};

    for (const price of data.data) {
      // Only fixed-price items
      if (price.unit_amount == null) continue;

      output[price.id] = {
        amount: (price.unit_amount / 100).toFixed(2),
        currency: (price.currency || "nzd").toUpperCase(),
      };
    }

    return new Response(JSON.stringify(output), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Failed to fetch prices",
        detail: String(err?.message || err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
