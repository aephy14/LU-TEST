import Stripe from "stripe";

export async function onRequestPost({ request, env }) {
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);

  const { items } = await request.json();

  if (!items || !items.length) {
    return new Response("No items provided", { status: 400 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: items.map(item => ({
      price: item.price,
      quantity: item.qty
    })),
    success_url: "https://lumafood.com/success/",
    cancel_url: "https://lumafood.com/products/",
    shipping_address_collection: {
      allowed_countries: ["NZ"]
    }
  });

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { "Content-Type": "application/json" }
  });
}
