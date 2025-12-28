import Stripe from "stripe";

export async function onRequestGet({ env }) {
  if (!env?.STRIPE_SECRET_KEY) {
    return new Response(
      JSON.stringify({ error: "Missing STRIPE_SECRET_KEY in environment variables." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
  });

  try {
    const prices = await stripe.prices.list({
      active: true,
      limit: 100,
    });

    const output = {};

    for (const price of prices.data) {
      // Skip prices that don't have a fixed unit amount (tiered/metered/etc.)
      if (price.unit_amount === null) continue;

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
        error: "Failed to fetch prices from Stripe.",
        detail: String(err?.message || err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
