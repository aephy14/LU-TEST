import Stripe from "stripe";

export async function onRequestGet({ env }) {
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);

  const prices = await stripe.prices.list({
    active: true,
    limit: 100
  });

  const output = {};
  prices.data.forEach(price => {
    output[price.id] = {
      amount: (price.unit_amount / 100).toFixed(2),
      currency: price.currency.toUpperCase()
    };
  });

  return new Response(JSON.stringify(output), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300"
    }
  });
}
