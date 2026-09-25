// URBANSTYLE FASHION — branded emails (Vercel serverless function)
//
// POST /api/send-email
//   { action: "verify" }                  + header Authorization: Bearer <Firebase ID token>
//   { action: "reset", email }            password reset (never reveals whether an account exists)
//   { action: "order", number }           order confirmation to the customer + a copy to the store
//
//   { action: "chat-new", chatId }        alerts the store that a customer is waiting in the live chat
//   { action: "chat-reply", chatId }      + team member's ID token: emails the customer the team's reply
//   { action: "status-check" }            checks the setup, sends nothing
//
// Emails are sent through Brevo (brevo.com, free for 300 emails a day). Firebase is only asked for the
// secure one-time codes; the links point to the store itself (/?mode=…&oobCode=…), which finishes the job.
//
// Setup: Vercel → Project → Settings → Environment Variables, then redeploy:
//   BREVO_API_KEY             your Brevo API key (xkeysib-…)
//   FIREBASE_SERVICE_ACCOUNT  the whole service-account JSON file from Firebase (paste the file's contents)
//   MAIL_FROM                 optional, the sender address you verified in Brevo (default urbanstylefashionng@gmail.com)
//   STORE_EMAIL               optional, where new-order alerts go (default urbanstylefashionng@gmail.com)
//   SITE_URL                  optional, e.g. https://urbanstyle-three.vercel.app (default: the address the request came to)
// Never put these keys in index.html or send them to anyone.

// No extra packages needed: this talks to Firebase's own web APIs using Node's built-in crypto.
const crypto = require("crypto");
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || "AIzaSyB_mF2UrTR22axNEmOKeV0iyMbPx_I4DUg"; // public web key (also in index.html)

const BRAND = "URBANSTYLE FASHION";
const MAIL_FROM = process.env.MAIL_FROM || "urbanstylefashionng@gmail.com";
const STORE_EMAIL = process.env.STORE_EMAIL || "urbanstylefashionng@gmail.com";
const PHONE = "0816 801 3667";
const WHATSAPP = "https://wa.me/2348168013667";
const RESEND_WAIT_MS = 60 * 1000;          // one email of each kind per minute per person
const ORDER_EMAIL_WINDOW_MS = 60 * 60 * 1000; // order emails only for orders placed in the last hour

/* ---------- a tiny Firebase admin client (service account → Google access token → REST APIs) ---------- */
let SA = null, TOKEN = null;
function serviceAccount() {
  if (!SA) {
    let raw = (process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
    if (raw && !raw.startsWith("{")) raw = Buffer.from(raw, "base64").toString("utf8"); // also accepts base64
    const j = JSON.parse(raw);
    if (!j.client_email || !j.private_key || !j.project_id) throw new Error("service account is missing client_email, private_key or project_id");
    j.private_key = j.private_key.replace(/\\n/g, "\n");
    SA = j;
  }
  return SA;
}
const b64url = b => Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
async function accessToken() {
  if (TOKEN && TOKEN.exp > Date.now() + 60000) return TOKEN.value;
  const sa = serviceAccount(), now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, sub: sa.client_email, aud: "https://oauth2.googleapis.com/token", scope: "https://www.googleapis.com/auth/cloud-platform", iat: now, exp: now + 3600 }));
  const sig = b64url(crypto.createSign("RSA-SHA256").update(head + "." + claims).sign(sa.private_key));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") + "&assertion=" + head + "." + claims + "." + sig });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error("google-auth-failed: " + (j.error_description || j.error || r.status));
  TOKEN = { value: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return TOKEN.value;
}
async function google(url, body, method = "POST") {
  const r = await fetch(url, { method, headers: { authorization: "Bearer " + (await accessToken()), "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}
const IDT = () => `https://identitytoolkit.googleapis.com/v1/projects/${serviceAccount().project_id}`;
const FS = () => `https://firestore.googleapis.com/v1/projects/${serviceAccount().project_id}/databases/(default)/documents`;
function fsDecode(v) {
  if (!v || typeof v !== "object") return v;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fsDecode);
  if ("mapValue" in v) return fsFields(v.mapValue.fields);
  return null;
}
const fsFields = f => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, fsDecode(v)]));
const fsEncode = v => typeof v === "number" ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : typeof v === "boolean" ? { booleanValue: v } : v == null ? { nullValue: null } : { stringValue: String(v) };

// Same shape as the firebase-admin calls used below
function firebase() {
  serviceAccount();
  const authApi = {
    // checks a signed-in customer's ID token with Google and returns who they are
    async verifyIdToken(idToken) {
      const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken }) });
      const j = await r.json().catch(() => ({}));
      const u = r.ok && j.users && j.users[0];
      if (!u) throw Object.assign(new Error("bad token"), { code: "auth/invalid-id-token" });
      return { uid: u.localId, email: u.email, name: u.displayName || "", email_verified: !!u.emailVerified };
    },
    async getUserByEmail(email) {
      const { ok, j } = await google(`${IDT()}/accounts:lookup`, { email: [email] });
      const u = ok && j.users && j.users[0];
      if (!u) throw Object.assign(new Error("no user"), { code: "auth/user-not-found" });
      return { uid: u.localId, email: u.email, displayName: u.displayName || "" };
    },
    generateEmailVerificationLink: (email, s) => oobLink("VERIFY_EMAIL", email, s),
    generatePasswordResetLink: (email, s) => oobLink("PASSWORD_RESET", email, s)
  };
  async function oobLink(requestType, email, settings) {
    const { ok, j } = await google(`${IDT()}/accounts:sendOobCode`, { requestType, email, returnOobLink: true, continueUrl: settings && settings.url });
    if (!ok || !j.oobLink) {
      const msg = (j.error && j.error.message) || "";
      if (/EMAIL_NOT_FOUND|USER_NOT_FOUND/.test(msg)) throw Object.assign(new Error(msg), { code: "auth/user-not-found" });
      throw new Error("oob-failed: " + msg);
    }
    return j.oobLink;
  }
  const doc = (col, id) => ({
    async get() {
      const { ok, status, j } = await google(`${FS()}/${col}/${encodeURIComponent(id)}`, null, "GET");
      if (status === 404) return { exists: false, data: () => undefined };
      if (!ok) throw new Error("firestore-read-failed " + status);
      return { exists: true, data: () => fsFields(j.fields) };
    },
    async set(data, opts) {
      const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, fsEncode(v)]));
      const mask = opts && opts.merge ? "?" + Object.keys(data).map(k => "updateMask.fieldPaths=" + encodeURIComponent(k)).join("&") : "";
      const { ok, status } = await google(`${FS()}/${col}/${encodeURIComponent(id)}${mask}`, { fields }, "PATCH");
      if (!ok) throw new Error("firestore-write-failed " + status);
    }
  });
  return { auth: () => authApi, firestore: () => ({ collection: col => ({ doc: id => doc(col, id) }) }) };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method-not-allowed" });
  if (!process.env.BREVO_API_KEY || !process.env.FIREBASE_SERVICE_ACCOUNT) return res.status(500).json({ ok: false, error: "not-configured" });

  let fb;
  try { fb = firebase(); } catch (e) { return res.status(500).json({ ok: false, error: "bad-service-account", detail: String(e.message || e).slice(0, 120) }); }
  const body = typeof req.body === "string" ? safeJSON(req.body) : req.body || {};
  if (body.action === "status-check") { // lets the store owner confirm the setup without sending anything
    try { await accessToken(); return res.status(200).json({ ok: true, ready: true, project: serviceAccount().project_id }); }
    catch (e) { return res.status(500).json({ ok: false, error: "google-auth-failed", detail: String(e.message || e).slice(0, 160) }); }
  }
  const site = siteUrl(req);
  try {
    if (body.action === "verify") return await sendVerify(fb, req, res, site);
    if (body.action === "reset") return await sendReset(fb, body, res, site);
    if (body.action === "order") return await sendOrder(fb, body, res, site);
    if (body.action === "chat-new") return await sendChatAlert(fb, body, res, site);
    if (body.action === "chat-reply") return await sendChatReply(fb, req, body, res, site);
    return res.status(400).json({ ok: false, error: "unknown-action" });
  } catch (e) {
    console.error("[send-email]", e && (e.code || e.message) || e);
    return res.status(502).json({ ok: false, error: "send-failed", detail: String((e && e.message) || e).slice(0, 160) });
  }
};

/* ---------- 1. verify email (signed-in customer only) ---------- */
async function sendVerify(fb, req, res, site) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ ok: false, error: "no-token" });
  let user;
  try { user = await fb.auth().verifyIdToken(token); } catch (e) { return res.status(401).json({ ok: false, error: "bad-token" }); }
  if (!user.email) return res.status(400).json({ ok: false, error: "no-email" });
  if (user.email_verified) return res.status(200).json({ ok: true, already: true });
  if (!(await allowSend(fb, "verify_" + user.uid))) return res.status(429).json({ ok: false, error: "too-soon" });

  const link = await fb.auth().generateEmailVerificationLink(user.email, { url: site + "/#account" });
  const url = storeLink(site, "verifyEmail", link);
  const first = String(user.name || "").split(" ")[0] || "there";
  await brevo({
    to: user.email, name: user.name, subject: `Confirm your email for ${BRAND}`,
    html: layout({
      preheader: "One tap to confirm your email and finish setting up your account.",
      title: `Welcome to ${BRAND}, ${esc(first)}!`,
      body: `<p>Thanks for creating an account. Please confirm your email address so we can keep your account secure and send you order updates.</p>`,
      button: ["Verify my email", url],
      after: `<p style="margin:0 0 8px">This link works once and expires in 3 days.</p><p style="margin:0">If you didn't create an account with us, you can safely ignore this email.</p>`,
      link: url
    }),
    text: `Welcome to ${BRAND}, ${first}!\n\nConfirm your email address: ${url}\n\nIf you didn't create an account with us, you can ignore this email.\n\n${signoffText()}`
  });
  return res.status(200).json({ ok: true });
}

/* ---------- 2. password reset ---------- */
async function sendReset(fb, body, res, site) {
  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) return res.status(400).json({ ok: false, error: "bad-email" });
  if (!(await allowSend(fb, "reset_" + sha(email)))) return res.status(200).json({ ok: true }); // quietly ignore repeats
  let link, name = "";
  try {
    const u = await fb.auth().getUserByEmail(email); name = u.displayName || "";
    link = await fb.auth().generatePasswordResetLink(email, { url: site + "/#login" });
  } catch (e) {
    if (e && e.code === "auth/user-not-found") return res.status(200).json({ ok: true }); // don't reveal it
    throw e;
  }
  const url = storeLink(site, "resetPassword", link);
  const first = name.split(" ")[0] || "there";
  await brevo({
    to: email, name, subject: `Reset your ${BRAND} password`,
    html: layout({
      preheader: "Choose a new password for your account.",
      title: `Hi ${esc(first)}, let's get you back in.`,
      body: `<p>We received a request to reset the password for your ${BRAND} account. Tap the button below to choose a new one.</p>`,
      button: ["Reset my password", url],
      after: `<p style="margin:0 0 8px">This link works once and expires in 1 hour.</p><p style="margin:0">If you didn't ask to reset your password, you can ignore this email. Your password won't change.</p>`,
      link: url
    }),
    text: `Hi ${first},\n\nReset your ${BRAND} password: ${url}\n\nThis link expires in 1 hour. If you didn't ask for this, ignore this email.\n\n${signoffText()}`
  });
  return res.status(200).json({ ok: true });
}

/* ---------- 3. order confirmation (+ alert to the store) ---------- */
async function sendOrder(fb, body, res, site) {
  const number = String(body.number || "");
  if (!/^US-\d{6}$/.test(number)) return res.status(400).json({ ok: false, error: "bad-order" });
  const ref = fb.firestore().collection("orders").doc(number);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ ok: false, error: "no-order" });
  const o = snap.data();
  if (o.emailSent) return res.status(200).json({ ok: true, already: true });
  if (Date.now() - new Date(o.date).getTime() > ORDER_EMAIL_WINDOW_MS) return res.status(200).json({ ok: true, skipped: true });
  await ref.set({ emailSent: new Date().toISOString() }, { merge: true }); // mark first, so a double call can't send twice

  const c = o.customer || {};
  const first = String(c.fullname || "").split(" ")[0] || "there";
  const track = o.trackToken ? `${site}/#track-${o.trackToken}` : `${site}/#account-orders`;
  const lines = (o.lines || []).map(l => `
    <tr><td style="padding:10px 0;border-bottom:1px solid #ECE8DE">
      <b style="color:#141414">${esc(l.name || "Item")}</b><br>
      <span style="color:#6C6C67;font-size:13px">${esc([l.color, l.size && l.size !== "One Size" ? "Size " + l.size : "", "Qty " + (l.qty || 1)].filter(Boolean).join(" · "))}</span>
    </td><td align="right" style="padding:10px 0;border-bottom:1px solid #ECE8DE;white-space:nowrap;font-weight:700">${naira((l.unit || 0) * (l.qty || 1))}</td></tr>`).join("");
  const row = (k, v, bold) => `<tr><td style="padding:4px 0;color:${bold ? "#141414" : "#6C6C67"};${bold ? "font-weight:800;font-size:16px" : ""}">${k}</td><td align="right" style="padding:4px 0;${bold ? "font-weight:800;font-size:16px" : ""}">${v}</td></tr>`;
  const summary = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin:18px 0 6px">${lines}</table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
      ${row("Subtotal", naira(o.subtotal))}
      ${o.discount ? row(`Discount${o.code ? " (" + esc(o.code) + ")" : ""}`, "−" + naira(o.discount)) : ""}
      ${row("Delivery" + (o.ship ? " · " + esc(shipName(o.ship)) : ""), o.delivery ? naira(o.delivery) : "Free")}
      ${row("Total", naira(o.total), true)}
      ${row("Payment", esc(o.pay || ""))}
    </table>
    <div style="margin:18px 0 0;padding:14px 16px;background:#F4F1EA;border-radius:12px;font-size:14px;line-height:1.5">
      <b>Delivering to</b><br>${esc(c.fullname || "")}<br>${esc(c.address || "")}<br>${esc([c.city, c.state].filter(Boolean).join(", "))}<br>${esc(c.phone || "")}
    </div>`;

  if (c.email) {
    await brevo({
      to: c.email, name: c.fullname, subject: `Order ${number} confirmed — thank you!`,
      html: layout({
        preheader: `We've got your order ${number}. Here's your summary and tracking link.`,
        title: `Thank you, ${esc(first)}! Your order is in.`,
        body: `<p>We've received order <b>${number}</b> and we're getting it ready. We'll message you on ${esc(c.phone || "your phone")} when it leaves the studio.</p>${summary}`,
        button: ["Track my order", track],
        after: `<p style="margin:0">Questions about your order? Reply to this email, chat with us on <a href="${WHATSAPP}" style="color:#141414">WhatsApp</a> or call ${PHONE}. Please have your order number ready.</p>`
      }),
      text: `Thank you, ${first}! We've received order ${number}.\n\nTotal: ${naira(o.total)} (${o.pay || ""})\nTrack it: ${track}\n\n${signoffText()}`
    });
  }
  // alert for the store team
  await brevo({
    to: STORE_EMAIL, name: BRAND, subject: `New order ${number} · ${naira(o.total)} · ${o.pay || ""}`,
    replyTo: c.email || undefined,
    html: layout({
      preheader: `${c.fullname || "A customer"} placed order ${number}.`,
      title: `New order ${number}`,
      body: `<p><b>${esc(c.fullname || "")}</b> · ${esc(c.email || "")} · ${esc(c.phone || "")}</p>${summary}`,
      button: ["Open the Team dashboard", `${site}/#admin-orders`],
      after: `<p style="margin:0">Reply to this email to write to the customer.</p>`
    }),
    text: `New order ${number} from ${c.fullname || ""} (${c.phone || ""}). Total ${naira(o.total)}. ${site}/#admin-orders`
  });
  return res.status(200).json({ ok: true });
}

/* ---------- 4. live chat: alert the store when a customer writes ---------- */
const CHAT_ALERT_GAP_MS = 30 * 60 * 1000;  // one alert per conversation per 30 minutes
const CHAT_REPLY_GAP_MS = 3 * 60 * 1000;   // one "we replied" email per conversation per 3 minutes
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "urbanstylefashionng@gmail.com").split(",").map(s => s.trim().toLowerCase());
async function chatMessages(chatId) {
  const { ok, j } = await google(`${FS()}/chats/${encodeURIComponent(chatId)}/messages?pageSize=30&orderBy=${encodeURIComponent("at desc")}`, null, "GET");
  return ok ? (j.documents || []).map(d => fsFields(d.fields)).reverse() : [];
}
const quote = list => list.map(m => `<div style="margin:0 0 10px;padding:12px 14px;border-radius:12px;background:${m.from === "customer" ? "#F4F1EA" : "#141414"};color:${m.from === "customer" ? "#141414" : "#FFFFFF"}">
  <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;opacity:.7;margin-bottom:4px">${m.from === "customer" ? "Customer" : m.from === "bot" ? "Auto-reply" : esc(m.name || "URBANSTYLE")}</div>${esc(m.text).replace(/\n/g, "<br>")}</div>`).join("");

async function sendChatAlert(fb, body, res, site) {
  const chatId = String(body.chatId || "");
  if (!/^c[a-z0-9]{20,40}$/.test(chatId)) return res.status(400).json({ ok: false, error: "bad-chat" });
  const ref = fb.firestore().collection("chats").doc(chatId), snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ ok: false, error: "no-chat" });
  const c = snap.data();
  if (c.alertedAt && Date.now() - new Date(c.alertedAt).getTime() < CHAT_ALERT_GAP_MS) return res.status(200).json({ ok: true, skipped: true });
  const msgs = await chatMessages(chatId);
  if (!msgs.some(m => m.from === "customer")) return res.status(200).json({ ok: true, skipped: true, reason: "no-customer-message-yet" });
  const recent = msgs.filter(m => m.from !== "bot").slice(-5);
  await brevo({
    to: STORE_EMAIL, name: BRAND, replyTo: c.email || undefined,
    subject: `💬 New chat from ${c.name || "a customer"}`,
    html: layout({
      preheader: (recent.filter(m => m.from === "customer").pop() || {}).text || "A customer is waiting for a reply.",
      title: `${esc(c.name || "A customer")} is waiting for a reply`,
      body: `<p style="margin:0 0 14px"><b>${esc(c.name || "")}</b> · <a href="mailto:${esc(c.email || "")}" style="color:#141414">${esc(c.email || "")}</a>${c.uid ? " · signed-in customer" : " · guest"}</p>${quote(recent)}`,
      button: ["Reply in the Support inbox", `${site}/#support-${chatId}`],
      after: `<p style="margin:0">Reply in the Support inbox so the customer sees it in the chat and gets it by email. You can also reply to this email to write to them directly.</p>`
    }),
    text: `${c.name || "A customer"} (${c.email || ""}) is waiting in the live chat:\n\n${recent.map(m => (m.from === "customer" ? "Customer: " : "Us: ") + m.text).join("\n")}\n\nReply: ${site}/#support-${chatId}`
  });
  await ref.set({ alertedAt: new Date().toISOString() }, { merge: true }); // only counts once the email has actually gone
  return res.status(200).json({ ok: true, sent: true });
}

/* ---------- 5. live chat: email the customer when the team replies ---------- */
async function sendChatReply(fb, req, body, res, site) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  let user;
  try { user = await fb.auth().verifyIdToken(token); } catch (e) { return res.status(401).json({ ok: false, error: "bad-token" }); }
  if (!user.email_verified || !ADMIN_EMAILS.includes(String(user.email || "").toLowerCase())) return res.status(403).json({ ok: false, error: "team-only" });
  const chatId = String(body.chatId || "");
  if (!/^c[a-z0-9]{20,40}$/.test(chatId)) return res.status(400).json({ ok: false, error: "bad-chat" });
  const ref = fb.firestore().collection("chats").doc(chatId), snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ ok: false, error: "no-chat" });
  const c = snap.data();
  if (!c.email) return res.status(200).json({ ok: true, skipped: true });
  if (c.replyMailedAt && Date.now() - new Date(c.replyMailedAt).getTime() < CHAT_REPLY_GAP_MS) return res.status(200).json({ ok: true, skipped: true });
  const msgs = await chatMessages(chatId);
  const lastCustomer = msgs.map(m => m.from).lastIndexOf("customer");
  const replies = msgs.slice(lastCustomer + 1).filter(m => m.from === "agent");
  if (!replies.length) return res.status(200).json({ ok: true, skipped: true, reason: "no-reply-yet" });
  const first = String(c.name || "").split(" ")[0] || "there";
  const url = `${site}/?chat=${chatId}`;
  const context = msgs.slice(Math.max(0, lastCustomer), lastCustomer + 1).concat(replies);
  await brevo({
    to: c.email, name: c.name, subject: `We've replied to your message · ${BRAND}`,
    html: layout({
      preheader: replies[replies.length - 1].text.slice(0, 120),
      title: `Hi ${esc(first)}, we've replied to your message`,
      body: `<p style="margin:0 0 14px">Here's the latest from our team:</p>${quote(context)}`,
      button: ["Continue the chat", url],
      after: `<p style="margin:0">You can also simply reply to this email, or message us on <a href="${WHATSAPP}" style="color:#141414">WhatsApp</a> (${PHONE}).</p>`
    }),
    text: `Hi ${first}, we've replied to your message:\n\n${replies.map(m => m.text).join("\n\n")}\n\nContinue the chat: ${url}\n\n${signoffText()}`
  });
  await ref.set({ replyMailedAt: new Date().toISOString() }, { merge: true });
  return res.status(200).json({ ok: true, sent: true });
}

/* ---------- helpers ---------- */
async function brevo({ to, name, subject, html, text, replyTo }) {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: BRAND, email: MAIL_FROM },
      to: [{ email: to, name: name || undefined }],
      replyTo: { email: replyTo || MAIL_FROM, name: BRAND },
      subject, htmlContent: html, textContent: text
    })
  });
  if (!r.ok) throw new Error("brevo " + r.status + " " + (await r.text()).slice(0, 200));
}

// one email of each kind per minute per person (stored in Firestore → emailLog, which customers can't read)
async function allowSend(fb, key) {
  const ref = fb.firestore().collection("emailLog").doc(key);
  const snap = await ref.get();
  const last = snap.exists ? snap.data().at || 0 : 0;
  if (Date.now() - last < RESEND_WAIT_MS) return false;
  await ref.set({ at: Date.now() });
  return true;
}

// Firebase's link → a link to our own store page, which finishes verification / password reset
function storeLink(site, mode, firebaseLink) {
  const code = new URL(firebaseLink).searchParams.get("oobCode");
  return `${site}/?mode=${mode}&oobCode=${encodeURIComponent(code)}`;
}

function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  return /^[a-z0-9.-]+(:\d+)?$/i.test(host) ? "https://" + host : "https://urbanstyle-three.vercel.app";
}

function layout({ preheader, title, body, button, after, link }) {
  const site = "https://urbanstyle-three.vercel.app";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(BRAND)}</title></head>
<body style="margin:0;padding:0;background:#F4F1EA;font-family:Arial,Helvetica,sans-serif;color:#141414">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F1EA"><tr><td align="center" style="padding:28px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
    <tr><td style="padding:0 4px 18px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="background:#141414;border-radius:12px;width:44px;height:44px;text-align:center;vertical-align:middle;color:#FFFFFF;font:800 24px Arial,sans-serif">U<span style="color:#C6F135">.</span></td>
        <td style="padding-left:12px;line-height:1.1"><b style="font-size:18px;letter-spacing:.02em">URBANSTYLE</b><br><span style="font-size:10px;letter-spacing:.38em;font-weight:700;border-bottom:3px solid #C6F135">FASHION</span></td>
      </tr></table>
    </td></tr>
    <tr><td style="background:#FFFFFF;border-radius:20px;padding:32px 28px;font-size:15px;line-height:1.6">
      <h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;color:#141414">${title}</h1>
      ${body}
      ${button ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td style="background:#C6F135;border-radius:999px"><a href="${button[1]}" style="display:inline-block;padding:14px 28px;font-weight:800;font-size:15px;color:#141414;text-decoration:none">${button[0]}</a></td></tr></table>` : ""}
      <div style="font-size:13px;color:#6C6C67;line-height:1.55">${after || ""}
      ${link ? `<p style="margin:14px 0 0">Button not working? Copy this link into your browser:<br><a href="${link}" style="color:#141414;word-break:break-all">${link}</a></p>` : ""}</div>
    </td></tr>
    <tr><td style="padding:22px 8px;text-align:center;font-size:12px;color:#6C6C67;line-height:1.6">
      <b style="color:#141414">${BRAND}</b> · Redemption City, Ogun State, Nigeria<br>
      ${PHONE} (call or WhatsApp) · <a href="mailto:${MAIL_FROM}" style="color:#6C6C67">${MAIL_FROM}</a><br>
      <a href="${site}" style="color:#141414;font-weight:700">Shop the collection</a> · <a href="https://www.instagram.com/urbanstylefashionng/" style="color:#6C6C67">Instagram</a> · <a href="https://www.tiktok.com/@urbanstylefashionng" style="color:#6C6C67">TikTok</a>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}
const signoffText = () => `— The ${BRAND} team\nRedemption City · ${PHONE} · ${MAIL_FROM}`;
const shipName = s => ({ standard: "Standard", express: "Express", pickup: "Studio pickup" }[s] || s);
const naira = n => "₦" + Math.round(Number(n) || 0).toLocaleString("en-NG");
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const sha = s => crypto.createHash("sha256").update(s).digest("hex").slice(0, 32);
function safeJSON(s) { try { return JSON.parse(s); } catch (e) { return {}; } }
