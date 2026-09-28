// Pre-written Coach answers. Matched locally (no AI, no credits) before the
// Coach falls back to the AI model. Each entry lists keyword groups: a question
// matches when it hits enough groups (any word within a group counts).

type Faq = { id: string; groups: string[][]; min?: number; answer: string };

const FAQS: Faq[] = [
  { id: "what-is", groups: [["what", "about", "explain"], ["oventric"]], answer: "Oventric is a marketplace and social community for digital products. You can shop from creators, earn cashback, post on the Feed, and open your own shop to sell digital goods — all paid in your home currency." },
  { id: "find-products", groups: [["find", "search", "discover", "browse", "look"], ["product", "products", "item", "items", "buy"]], answer: "Open **Market** from the bottom bar to browse categories, or use **Explore** to search by name, seller or category. Tap any product for a quick preview, then open it for full details and reviews." },
  { id: "how-buy", groups: [["how", "can"], ["buy", "purchase", "order", "checkout", "pay"]], answer: "Open a product, tap **Buy**, and complete secure checkout with your wallet balance or a card. Your payment is held in escrow and your digital item is delivered to your orders and chat." },
  { id: "escrow", groups: [["escrow", "held", "hold", "protected", "safe", "secure"], ["payment", "money", "escrow", "buy", "funds", "work"]], answer: "When you buy, your payment is held in **escrow** — the seller doesn't receive it until the order is delivered and confirmed. This protects you if something goes wrong." },
  { id: "cashback", groups: [["cashback", "cash back", "reward", "rewards"]], min: 1, answer: "Some products offer **cashback** — a percentage of what you pay is returned to your wallet after the order completes. It's funded by the seller, and you'll see the cashback % on product cards." },
  { id: "physical", groups: [["physical", "shipping", "ship", "delivery", "deliver"], ["product", "products", "goods", "item", "sell", "items"]], answer: "Oventric is for **digital goods only** — things like courses, templates, software, e-books and accounts. Physical products and shipping aren't supported." },
  { id: "start-selling", groups: [["start", "become", "how", "open", "create"], ["sell", "selling", "seller", "shop", "store"]], answer: "Tap the **＋** button in Market (or open **Seller Hub** from your profile) to list your first product. Add a title, price, images and your delivery/activation details, then publish." },
  { id: "seller-earn", groups: [["seller", "sellers", "i"], ["earn", "commission", "fee", "fees", "percent", "percentage", "cut", "keep"]], answer: "Sellers keep **80%** of each sale; Oventric keeps 20% as its platform fee. Any cashback you offer is paid out of your 80% share." },
  { id: "seller-paid", groups: [["when", "how"], ["seller", "i"], ["paid", "receive", "money", "payout", "released"]], answer: "Your earnings are released from escrow into your wallet once the buyer's order is delivered and completes. From there you can withdraw to your bank." },
  { id: "add-funds", groups: [["add", "fund", "top", "deposit", "load"], ["wallet", "money", "funds", "balance", "up"]], answer: "Go to **Wallet** and tap **Add funds**, choose an amount in your home currency and pay securely. Your balance updates as soon as the payment is confirmed." },
  { id: "withdraw", groups: [["withdraw", "withdrawal", "cash out", "cashout", "payout"]], min: 1, answer: "Go to **Wallet → Withdraw**, pick your bank or USD payout, enter the amount and confirm with your **4-digit PIN**. You'll need Tier 3 verification to withdraw." },
  { id: "usd-rate", groups: [["usd", "dollar", "dollars"], ["withdraw", "rate", "less", "receive", "exchange"]], answer: "USD withdrawals are converted at the live rate with a **3% margin**, so you receive slightly less than the wallet's USD equivalent. The minimum you can receive is **$5**." },
  { id: "currency", groups: [["currency", "currencies", "naira", "cedis", "convert", "conversion"]], min: 1, answer: "Everything on Oventric is shown and paid in **your home currency**. Prices from sellers anywhere are converted automatically at the live exchange rate." },
  { id: "pin", groups: [["pin"]], min: 1, answer: "Your **4-digit PIN** confirms withdrawals. You can set or change it in **Wallet → Settings**. Never share it with anyone — Oventric staff will never ask for it." },
  { id: "verification", groups: [["verify", "verification", "verified", "tier", "kyc", "selfie"]], min: 1, answer: "Tier 3 verification is quick: confirm your **phone number**, then take a **selfie**. No government ID is needed. It unlocks withdrawals." },
  { id: "hide-balance", groups: [["hide", "blind", "mask", "show", "privacy"], ["balance", "money", "wallet", "amount"]], answer: "Tap the **eye icon** on your wallet card to hide or show your balances — handy when using your phone in public." },
  { id: "post", groups: [["post", "posts", "write", "share", "publish"], ["how", "feed", "create", "make", "good"]], answer: "Tap **＋** on the Feed to open the composer. Write something useful, add a photo or video (up to 50 MB) and a topic hashtag, then publish. Short, helpful posts with a clear image get the most engagement." },
  { id: "follow", groups: [["follow", "following", "unfollow"]], min: 1, answer: "Open someone's profile and tap **Follow**. Their posts will appear in your **Following** tab on the Feed." },
  { id: "chat-seller", groups: [["message", "chat", "contact", "talk", "dm"], ["seller", "someone", "user", "shop", "creator"]], answer: "Open the seller's shop or profile and tap **Message**. All your chats live under the chat icon at the top of the app." },
  { id: "order-where", groups: [["where", "find", "see", "view"], ["order", "orders", "purchase", "purchases", "download", "item"]], answer: "Your purchases are in **Profile → Orders**. Each order also opens a chat with the seller where delivery details and activation steps appear." },
  { id: "refund", groups: [["refund", "dispute", "problem", "scam", "not received", "wrong", "complaint"]], min: 1, answer: "If an order isn't delivered or isn't as described, open the order and tap **Report a problem** to raise a dispute. Because your payment is in escrow, our team can review and refund you if needed." },
  { id: "notifications", groups: [["notification", "notifications", "alerts", "push"]], min: 1, answer: "Tap the **bell icon** at the top to see notifications. To get alerts on your phone, allow notifications when the app asks, or enable them in your phone settings." },
  { id: "install", groups: [["install", "download", "app", "home screen"], ["app", "phone", "android", "iphone", "ios"]], answer: "On Android, tap **Install** when prompted (or browser menu → Install app). On iPhone, open Oventric in Safari, tap **Share → Add to Home Screen**." },
  { id: "profile-edit", groups: [["edit", "change", "update"], ["profile", "name", "photo", "picture", "bio", "username"]], answer: "Go to **Profile** and tap **Edit profile** to change your photo, name, bio or skills." },
  { id: "top-sellers", groups: [["top", "best", "popular"], ["sellers", "seller", "creators", "shops"]], min: 2, answer: "Check the **Top Sellers** section on Market or Explore — sellers are ranked by paid sales. Tap any seller to visit their shop." },
  { id: "coach-limit", groups: [["coach", "you", "messages"], ["limit", "many", "daily", "cap"]], answer: "You can ask the Coach **5 AI questions per day** (resets at midnight UTC). Common questions like this one are answered instantly and don't count." },
  { id: "greeting", groups: [["hi", "hello", "hey", "good morning", "good afternoon", "good evening", "thanks", "thank you"]], min: 1, answer: "Hi! 👋 I'm your Oventric Coach. Ask me about finding products, your wallet, selling, or writing posts." },
];

const STOP = new Set(["the", "a", "an", "is", "to", "do", "i", "my", "me", "on", "in", "of", "for", "it", "and", "or", "can", "you"]);

function normalize(s: string) {
  return ` ${s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()} `;
}

/** Words that mean the user wants their own live data — always go to the AI tools. */
const PERSONAL = /\b(my|mine)\s+(balance|orders?|sales|earnings|wallet|products?|stats)\b|\bhow much (do i|have i|did i)\b|\bshow me\b/;

export function matchCoachFaq(question: string): string | null {
  const text = normalize(question);
  if (text.length > 160 || PERSONAL.test(text)) return null;
  const hasWord = (w: string) => text.includes(` ${w} `);
  const isGreetingOnly = text.split(" ").filter((w) => w && !STOP.has(w)).length <= 3;

  let best: { faq: Faq; score: number } | null = null;
  for (const faq of FAQS) {
    const score = faq.groups.filter((g) => g.some(hasWord)).length;
    const need = faq.min ?? faq.groups.length;
    if (faq.id === "greeting" && !isGreetingOnly) continue;
    if (score >= need && (!best || score > best.score)) best = { faq, score };
  }
  return best?.faq.answer ?? null;
}
