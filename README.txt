URBANSTYLE FASHION — Online Store
==================================

GO-LIVE CHECKLIST (do these in order)
 1. GitHub: create a repository and upload EVERYTHING inside urbanstyle-vercel-upload.zip
    (index.html, vercel.json, sw.js, manifest.webmanifest, robots.txt, favicon.ico, the icon/og PNGs,
    and the api/ and photos/ folders). Missing photos/ = missing pictures.
 2. Vercel: Add New → Project → import the repository → Deploy (no build settings needed).
 3. Firebase console → Authentication → Settings → Authorized domains → add your-site.vercel.app
    (and your own domain later). Without this, sign-in fails on the live site.
 4. Firebase → Firestore Database → Rules → paste firestore.rules → Publish.
 5. Create the team account with urbanstylefashionng@gmail.com on the live site and click the
    verification email. Then open yoursite/#admin to check the Team dashboard.
 6. In index.html, change og-image.png to the full address (https://your-site.vercel.app/og-image.png)
    so WhatsApp/Instagram/X show the preview picture. Commit; Vercel redeploys by itself.
 7. Payments (when ready): paste the Paystack PUBLIC key in index.html (search "publicKey"), add the
    SECRET key in Vercel → Settings → Environment Variables as PAYSTACK_SECRET_KEY, then Redeploy.
 8. Test on your phone: place one Pay-on-delivery order, check it appears in #admin, move it to
    Shipped and open the tracking link. Send a contact message and a live-chat message.
 9. Review prices, materials and stock for every product, the Privacy policy and Terms, and add the
    team names (search "const TEAM" in index.html).
10. Share the link on Instagram, TikTok, X and Pinterest.
Keep prices in index.html and api/verify-payment.js the same. Every time you change a price, change both.

HOW TO OPEN IT
1. Right-click the zip file and choose "Extract All…" (don't open files from inside the zip).
2. Double-click index.html. It opens in your browser. No installs needed.
   (Online customer accounts need the site to be hosted. See "WHERE ONLINE ACCOUNTS WORK" below.)

The whole store is inside index.html: all styling, all product images, the cart and the checkout.
The images/ folder holds copies of every picture as separate files (SVG) for use elsewhere,
such as social media, printing or a future platform. The website does not need that folder to run.

PAGES
- Home     : hero, shop by category, featured products, collections, newsletter
- Shop     : 24 products, category tabs, size / colour / price filters, sort, load more
- Product  : image gallery (front, back, styled, close-up), colours, sizes, stock, quantity, Add to Cart
- Bag      : line items, quantities, remove, promo codes, delivery, order total
- Checkout : contact, delivery address, delivery method, payment method, order confirmation
- About    : story, values, timeline, materials, process, work-with-us
- Contact  : validated form, WhatsApp, studio hours, help topics, FAQ, wholesale/press/collabs
- Help     : Delivery, Returns & exchanges, Size guide (tops, trousers, sneakers), FAQ
- Journal  : 3 style/care articles with "Shop the story"
- Privacy policy and Terms of service

EDITING THE WRITTEN CONTENT
Search index.html for "EDITORIAL + HELP CONTENT". FAQs, category introductions, product questions and
Journal articles are all there. Help pages are under "Help Centre", legal pages under "Legal".
Contact details in use: urbanstylefashionng@gmail.com · 0816 801 3667 (phone and WhatsApp) ·
Redemption City, Ogun State.
The brand story, mission and "How we work" on the About page (and the story strip on the home page)
use the team's own text: founded in 2026 on the RISE Training Program by five people.
PLEASE REVIEW BEFORE LAUNCH: studio hours, and the Privacy policy and Terms of service are
written as starting templates. Replace them with your real details, and have a lawyer check the legal pages.

CUSTOMER ACCOUNTS
- Sign in / Create account: person icon in the header (or "Sign in" in the mobile menu).
- Create account: name, email, password (8+ characters with a letter and a number), strength meter,
  marketing opt-in, terms checkbox. Duplicate emails are blocked.
- Sign in: "Keep me signed in" option, show/hide password, and Firebase's own protection against
  repeated wrong passwords.
- My account: Overview, Orders (with "Buy again"), Wishlist, saved delivery Address, Account details
  (edit name/phone, change password, delete account with password confirmation), Sign out.
- Checkout fills in your details automatically when you're signed in, and saves the order to the account.
  Guests can create an account from the order confirmation page, and that order is attached to it.

ACCOUNTS ARE CONNECTED TO YOUR FIREBASE PROJECT (urban-website-83665)
- Sign-up / sign-in use Firebase Authentication, so accounts work on every device.
- "Forgot password" sends a real reset email. New accounts get a "verify your email" email.
- Each customer's profile, address, wishlist and order history is stored in Cloud Firestore
  (customers/{id}). Every order, including guest orders, is also saved in Firestore → orders,
  so you can see all orders in the Firebase console.
- You can see all customer accounts in Firebase console → Authentication → Users.

ONE-TIME SETUP IN THE FIREBASE CONSOLE (https://console.firebase.google.com, project urban-website-83665)
1. Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save.
2. Build → Firestore Database → Create database → choose a location near your customers
   (e.g. europe-west) → Start in production mode → Create.
3. Firestore Database → Rules → replace everything with the contents of firestore.rules
   (included in this folder) → Publish.
4. Put the site online (Firebase Hosting, Netlify, Vercel or your web host). Then in
   Authentication → Settings → Authorized domains, add your domain (e.g. urbanstylefashion.com).
   "localhost" is already allowed for testing on your computer.
5. Optional: Authentication → Templates, to put your brand name on the verification and reset emails.

WHERE ONLINE ACCOUNTS WORK
Firebase sign-in needs the site to be opened from a web address (http:// or https://).
If you double-click index.html on your computer, or view the Claude preview link, the store
switches to "preview mode": accounts are saved on that device only, and the sign-in page says so.
The code is in index.html under "CUSTOMER ACCOUNTS" (the Firebase settings are in FIREBASE_CONFIG).

SELLER MARKETPLACE
Anyone can open a store and sell on the site (like Jumia or Etsy):
- Everything account-related lives in MY ACCOUNT (the person icon in the header):
    Signed out: tabs for Sign in · Create account · Sell on URBANSTYLE
    Signed in : Overview · Orders · Wishlist · Address · Account details · Sell on URBANSTYLE
  "Sell on URBANSTYLE" → Start selling. Visitors create an account first and come straight back to
  the store form; signed-in customers open their store right inside My account: name, unique web
  address (#store-their-name), tagline, about, phone, location, logo. Existing sellers see their store
  summary there, with links to the Seller Centre, Add product and their store page.
- Seller Centre (#seller):
    Overview   : sales/orders/items sold (30 days), 14-day sales chart, to-do list, recent orders
    Products   : search, filter (live/draft/sold out), edit, delete
    Add product: up to 4 photos (drag & drop, resized automatically), department, type, description,
                 key features, price + sale price (shows the seller's earnings after commission),
                 sizes with stock per size, colours, material/care/fit, Live or Draft
    Orders     : New → Processing (stock is deducted) → Shipped (tracking note) → Delivered, or Cancel
                 (stock returned); customer's delivery address, phone, WhatsApp and payment details
    Customers  : everyone who bought from the store, orders, total spent, repeat customers
    Store      : edit store details and logo, copy the store link
- Customers see seller products in Shop, categories, New In/Sale, search, and the seller's store page,
  marked "Sold by <store>". A bag can mix URBANSTYLE and seller items; at checkout each seller
  receives only their part of the order. Customers see each seller's delivery status in My account.
Setup: publish the updated firestore.rules (Firestore Database → Rules). Sellers can't do anything until you do.
Approving sellers yourself: see the comment in firestore.rules (change 'active' to 'pending').
Commission shown to sellers: search index.html for "commissionPct" (currently 10%).
Photos are stored in Firestore (free plan friendly). For a large catalogue, move photos to Firebase
Storage later (needs the Blaze plan).
Seller payouts are not automated yet: pay sellers manually, or set up Paystack split payments/subaccounts.

LIVE CHAT
- Customers: a "Chat" bubble on every page. It shows Online (Mon–Sat, 9am–6pm Lagos time) or Away,
  gives instant answers (track order, sizing, delivery & returns, payment), and "Talk to a person"
  starts a real conversation (guests give their name and email first). Messages update live.
  A "Prefer WhatsApp?" link opens WhatsApp on 0816 801 3667. New replies show a badge on the bubble.
- Your team: the SUPPORT INBOX at #support (also a "Support inbox" button in My account). Open,
  Resolved and All conversations, unread counts, quick replies, Mark resolved, and the customer's email.
- Who can use the inbox: urbanstylefashionng@gmail.com only. Create a site account with that email
  and click the verification link Firebase sends (required). To add more team members, add their
  emails in BOTH index.html (search "adminEmails") and firestore.rules (function isAdmin).
- Setup: publish the updated firestore.rules.
- Note: nobody is notified by email or phone when a new chat arrives; keep the inbox open during
  opening hours. (Email alerts can be added later with a Firebase extension.)

ONLINE PAYMENTS (PAYSTACK)
Checkout offers "Pay online now" (card, bank transfer, USSD, bank app via Paystack) and "Pay on delivery".
How it works:
  1. The customer pays in Paystack's secure window. Card details never touch this site.
  2. The site asks api/verify-payment.js (runs on Vercel) to confirm. That function re-prices the bag
     itself and checks with Paystack, using your SECRET key, that exactly that amount was paid.
  3. Only then is the order marked "Paid online". If the amounts don't match, the order is saved for
     review and the customer is shown the payment reference to contact you with.
Setup:
  1. Create a Paystack account at https://paystack.com and complete business verification
     (needed before you can take live payments).
  2. Paystack dashboard → Settings → API Keys & Webhooks. Copy the TEST public key (pk_test_…).
  3. In index.html, search for "paystack:" and paste the public key between the quotes of publicKey.
  4. Vercel → your project → Settings → Environment Variables → add
       Name: PAYSTACK_SECRET_KEY    Value: your TEST secret key (sk_test_…)
     then Deployments → Redeploy. NEVER put the secret key in index.html or send it to anyone.
  5. Test on your Vercel site with Paystack's test cards (Paystack docs → "Test payments").
  6. To go live: swap in pk_live_… (index.html) and sk_live_… (Vercel), then redeploy.
Keep prices in sync: when you change a price, sale price, delivery fee or promo code in index.html,
make the same change at the top of api/verify-payment.js, or paid orders will fail verification.
Online payment only appears on the hosted site. Opened as a local file or in the Claude preview,
checkout shows Pay on delivery only.

TRY IT
- Promo codes: WELCOME10 (10% off), URBAN15 (15% off)
- Free standard delivery over N50,000
- The bag is saved in the browser, so it survives page refreshes.

THE PHOTOGRAPHED COLLECTION (photos/ folder)
Nine products use your real studio photos (p25–p33): Magenta Ruched Halter Maxi Dress, Chocolate Tulle-Trim
Wrap Maxi Dress, Essential White Crew Tee, Olive Double-Breasted Suit, Kids' Personalised Football Kit,
Ankara Peplum Blouse, Abstract Line-Print Maxi Dress, Blush Embroidered Organza Shift Dress and Crown
Graphic Oversized Tee. They are listed first in the shop, featured on the home page, and there is a new
Kids category. A second drop (p34–p45) adds the Green '24' Varsity Jersey Tee, Plaid Side-Stripe Track
Pants, Bronze Shimmer Wrap Midi Dress, Vintage Tan Leather Holdall Bag, Acid-Wash Star Denim Jorts, Pink
Camo Canvas Zip Pouch, Rose Pleated Drop-Waist Dress, three watches, Black Leather H-Strap Slides and the
Custom Print Dad Cap (red and black, each colour with its own photos via "colorPhotos"). Each product's photos are listed in its "photos:" line in index.html (first = main picture,
second = the one shown on hover, the rest = more angles and close-ups cropped from your photos).
To add another photographed product: put the pictures in photos/ (portrait, about 900 px wide), copy one
of the p25–p33 entries, give it a new id (p34…), and add the same id and price to api/verify-payment.js.
PLEASE CHECK: prices, fabric/material lines and stock levels for these nine are sensible starting values;
change them to the real ones. The upload folder must include the photos/ folder or the pictures won't show.

EDITING PRODUCTS AND PRICES
Open index.html in a text editor (Notepad, VS Code) and search for "const PRODUCTS".
Each product has a name, category, price, optional salePrice, colours, sizes, and stock notes:
  oos: ["Black|XS"]   = that colour/size is out of stock
  low: ["Black|L"]    = shows "Only 2 left"
  soldOut: true       = whole product sold out
Search for "const CFG" to change the currency, delivery fees, free-delivery threshold, promo codes and
the featured products on the home page.

TEAM DASHBOARD AND STORE OPERATIONS
Sign in as urbanstylefashionng@gmail.com (with the email verified) and open My account → Team dashboard
(or go to yoursite/#admin). It has:
- Overview: sales, orders to process, open returns, new messages, subscribers, stock alerts.
- Orders: every order. Move each one Placed → Processing → Shipped → Delivered (add a rider/tracking
  note). The customer's tracking page and "My orders" update straight away.
- Returns: requests customers send from My orders (within 7 days). Approve, mark received, refunded.
- Messages: the Contact form inbox. Reply opens your email; mark handled.
- Subscribers: newsletter sign-ups. "Copy all emails" pastes into Mailchimp/Brevo/Gmail.
- Stock alerts: people who asked to be told when a sold-out size is back.
- Reviews: hide any review that breaks the rules, or publish it again.
Customer-facing features added: ratings and reviews (with fit feedback and a "Verified buyer" badge when
the reviewer bought the item), order tracking link on every order (no sign-in needed), returns
requests, back-in-stock alerts, share buttons, "Recently viewed", printable receipts, and "Install app"
(the site can be added to a phone's home screen: manifest.webmanifest, sw.js and the icon-*.png files).
IMPORTANT: paste the new firestore.rules into Firebase → Firestore → Rules → Publish again. Until you do,
reviews, tracking, returns, the marketplace and chat show "permission denied" on the live site.

ANALYTICS (OPTIONAL)
Search index.html for "ga4:" and paste your Google Analytics 4 ID (G-XXXXXXX) and/or Meta Pixel ID.
They only load after a visitor accepts the cookie banner. Leave them empty to use no tracking at all.

LINK PREVIEWS
When you know your Vercel address, search index.html for og-image.png and change it to the full
address, e.g. https://your-site.vercel.app/og-image.png, so WhatsApp/Instagram/X show the picture.

BEFORE GOING LIVE
- Orders, contact messages and newsletter sign-ups are saved to Firestore and shown in the Team
  dashboard, but nobody is emailed automatically. Check the dashboard daily, or add a Firebase email
  extension ("Trigger Email") later for instant notifications.
- The product pictures are detailed illustrations. Swap in real product photography when you have it.
