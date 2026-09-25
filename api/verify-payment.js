// URBANSTYLE FASHION — Paystack payment verification (Vercel serverless function)
//
// POST /api/verify-payment  { reference, lines: [{ id, size, qty }], ship, promo }
//
// The browser can't be trusted with prices, so this function:
//   1. re-prices the bag from the price list below,
//   2. asks Paystack (with the SECRET key) what was actually paid for `reference`,
//   3. only answers ok:true if Paystack reports success, in NGN, for exactly that total.
//
// Setup: Vercel → Project → Settings → Environment Variables → add PAYSTACK_SECRET_KEY
// (sk_test_… while testing, sk_live_… when live), then redeploy. Never put the secret key in index.html.
//
// IMPORTANT: keep these prices, delivery fees and promo codes in step with CFG and PRODUCTS in index.html.
// (Seller products don't need listing here: their prices are read live from Firestore.)

const PRICES = {
  p01: { price: 15000, surcharge: { XXL: 1500 } },
  p02: { price: 32000, sale: 25500, surcharge: { XXL: 1500 } },
  p03: { price: 28000 },
  p04: { price: 45000, surcharge: { XXL: 2000 } },
  p05: { price: 33000, surcharge: { "36": 1500 } },
  p06: { price: 22000, sale: 17600 },
  p07: { price: 21000 },
  p08: { price: 16500 },
  p09: { price: 27500 },
  p10: { price: 12000, sale: 9500 },
  p11: { price: 30000 },
  p12: { price: 19500 },
  p13: { price: 38000, sale: 30400 },
  p14: { price: 26000 },
  p15: { price: 24000 },
  p16: { price: 29500 },
  p17: { price: 11000 },
  p18: { price: 8500 },
  p19: { price: 52000, soldOut: true },
  p20: { price: 14000, sale: 11200 },
  p21: { price: 17500 },
  p22: { price: 7500 },
  p23: { price: 36000 },
  p24: { price: 48000 },
  // photographed collection
  p25: { price: 38000 },
  p26: { price: 58000 },
  p27: { price: 12500, surcharge: { XXL: 1000 } },
  p28: { price: 125000, surcharge: { "46R": 5000 } },
  p29: { price: 22000 },
  p30: { price: 18500, sale: 15500 },
  p31: { price: 35000 },
  p32: { price: 42000 },
  p33: { price: 18000, surcharge: { XXL: 1500 } },
  p34: { price: 16000, surcharge: { XXL: 1000 } },
  p35: { price: 24000 },
  p36: { price: 26000 },
  p37: { price: 32000 },
  p38: { price: 19500 },
  p39: { price: 7000 },
  p40: { price: 23000 },
  p41: { price: 45000 },
  p42: { price: 38000 },
  p43: { price: 25000 },
  p44: { price: 35000 },
  p45: { price: 9500 }
};
const DELIVERY = { standard: 3500, express: 6000, pickup: 0 };
const FREE_DELIVERY_OVER = 50000;
const PROMO_CODES = { WELCOME10: 0.10, URBAN15: 0.15 };

// Marketplace (seller) products live in Firestore. Live listings are publicly readable,
// so their current price is fetched straight from Firestore's REST API.
const FIREBASE_PROJECT = process.env.FIREBASE_PROJECT_ID || "urban-website-83665";
async function sellerPrice(id) {
  if (!/^m[a-z0-9]{4,40}$/.test(id)) return null;
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/products/${id}`);
  if (!r.ok) return null;
  const f = ((await r.json()) || {}).fields || {};
  const num = v => v ? Number(v.integerValue ?? v.doubleValue ?? 0) : 0;
  if ((f.status && f.status.stringValue) !== "active") return null;
  const price = num(f.price), sale = num(f.salePrice);
  return { price, sale: sale > 0 && sale < price ? sale : undefined };
}

async function priceBag(lines, ship, promo) {
  let subtotal = 0;
  for (const l of lines) {
    const p = PRICES[l && l.id] || (l && typeof l.id === "string" ? await sellerPrice(l.id) : null);
    if (!p || p.soldOut) throw new Error("unknown-item");
    const qty = parseInt(l.qty, 10);
    if (!(qty >= 1 && qty <= 10)) throw new Error("bad-quantity");
    const unit = (p.sale || p.price) + ((p.surcharge && p.surcharge[l.size]) || 0);
    subtotal += unit * qty;
  }
  const rate = PROMO_CODES[String(promo || "").toUpperCase()] || 0;
  const discount = Math.round(subtotal * rate);
  const afterDiscount = subtotal - discount;
  const method = Object.prototype.hasOwnProperty.call(DELIVERY, ship) ? ship : "standard";
  const delivery = method === "standard" && afterDiscount >= FREE_DELIVERY_OVER ? 0 : DELIVERY[method];
  return afterDiscount + delivery;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method-not-allowed" });

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return res.status(500).json({ ok: false, error: "not-configured" });

  const body = typeof req.body === "string" ? safeJSON(req.body) : req.body || {};
  const { reference, lines, ship, promo } = body;
  if (typeof reference !== "string" || !/^[A-Za-z0-9._=-]{6,100}$/.test(reference)) return res.status(400).json({ ok: false, error: "bad-reference" });
  if (!Array.isArray(lines) || !lines.length || lines.length > 50) return res.status(400).json({ ok: false, error: "bad-bag" });

  let expected;
  try { expected = await priceBag(lines, ship, promo); }
  catch (e) { return res.status(400).json({ ok: false, error: e.message }); }

  let tx;
  try {
    const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` }
    });
    const j = await r.json();
    tx = j && j.status ? j.data : null;
  } catch (e) {
    return res.status(502).json({ ok: false, error: "paystack-unreachable" });
  }

  if (!tx || tx.status !== "success") return res.status(402).json({ ok: false, error: "not-paid" });
  if (tx.currency !== "NGN" || tx.amount !== expected * 100) {
    return res.status(402).json({ ok: false, error: "amount-mismatch", expected, paid: tx.amount / 100 });
  }
  return res.status(200).json({ ok: true, reference: tx.reference, total: expected, paidAt: tx.paid_at, channel: tx.channel });
};

function safeJSON(s) { try { return JSON.parse(s); } catch (e) { return {}; } }
