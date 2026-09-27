/**
 * Page-aware Coach nudges. Each page has a pool of varied openers; one is
 * picked at random (avoiding the last few shown) so nudges never feel canned.
 * `ask` is what the bubble says; `reply` is what gets sent if the user taps it.
 */
export interface CoachPrompt { ask: string; reply: string }

const P = (ask: string, reply: string): CoachPrompt => ({ ask, reply });

export const COACH_PAGE_PROMPTS: Record<string, CoachPrompt[]> = {
  home: [
    P("Hi {name}, want a quick tour of what's worth your time today?", "Show me what's worth my time on Oventric today."),
    P("{name}, shall I suggest one small win you could chase today?", "Suggest one small win I could chase today."),
    P("Curious what's trending right now, {name}? I can sum it up.", "Summarise what's trending on Oventric right now."),
    P("Hey {name}, need a hand figuring out where to start?", "Help me figure out where to start on Oventric."),
  ],
  following: [
    P("Hi {name}, do you need help crafting a good post for your followers?", "Help me craft a good post for my followers."),
    P("{name}, want a few post ideas your followers would love?", "Give me a few post ideas my followers would love."),
    P("Stuck on what to say, {name}? I can draft a warm update with you.", "Draft a warm update post for my followers with me."),
    P("Want tips to spark more replies from the people you follow, {name}?", "How can I spark more conversations with people I follow?"),
  ],
  foryou: [
    P("Hi {name}, want help turning a thought into a post people stop for?", "Help me turn an idea into a post people stop scrolling for."),
    P("{name}, shall I suggest a catchy opening line for your next post?", "Suggest catchy opening lines for my next post."),
    P("Seeing anything inspiring, {name}? I can help you riff on it.", "Help me write a post inspired by what's trending in my feed."),
  ],
  shop: [
    P("Hi {name}, looking for something specific? I can help you narrow it down.", "Help me find the right digital product for what I need."),
    P("{name}, want tips on spotting a great digital product before you buy?", "How do I spot a great digital product before buying?"),
    P("Thinking of selling here too, {name}? I can show you how to start.", "How do I start selling my own digital products?"),
  ],
  creators: [
    P("Hi {name}, want ideas for your next showcase piece?", "Give me ideas for my next creator showcase piece."),
    P("{name}, shall I help you write a caption that makes people tap?", "Help me write a showcase caption that makes people tap."),
    P("Want to know what makes top creators here stand out, {name}?", "What makes top creators on Oventric stand out?"),
  ],
  market: [
    P("Hi {name}, need help finding the perfect template or tool?", "Help me find the perfect digital product for my needs."),
    P("{name}, want me to explain how instant downloads and cashback work?", "Explain how instant downloads and cashback work."),
    P("Got something to sell, {name}? I can help you price it well.", "Help me price a digital product I want to sell."),
    P("Browsing for ideas, {name}? Tell me your goal and I'll point the way.", "I'll tell you my goal — point me to useful products."),
  ],
  explore: [
    P("Hi {name}, what are you hunting for? I can help you search smarter.", "Help me search Oventric smarter for what I need."),
    P("{name}, want me to suggest creators worth following?", "Suggest the kind of creators worth following for me."),
    P("Not sure what to look up, {name}? Let's brainstorm together.", "Help me brainstorm what to explore on Oventric."),
  ],
  wallet: [
    P("Hi {name}, want a quick explainer on funding and withdrawals?", "Explain how funding and withdrawals work."),
    P("{name}, curious how cashback adds up in your wallet?", "How does cashback add up in my wallet?"),
    P("Any questions about your balance, {name}? I'm happy to walk through it.", "Walk me through my wallet and balance."),
  ],
  default: [
    P("Hi {name}, need a hand with anything on this page?", "Help me make the most of this page."),
    P("{name}, got a question? I'm right here.", "I have a question about Oventric."),
  ],
};

export function pickCoachPrompt(pageKey: string, name: string): CoachPrompt {
  const pool = COACH_PAGE_PROMPTS[pageKey] ?? COACH_PAGE_PROMPTS.default;
  const recentKey = `oventric:coach-recent:${pageKey}`;
  let recent: string[] = [];
  try { recent = JSON.parse(window.localStorage.getItem(recentKey) || "[]"); } catch { /* ignore */ }
  const fresh = pool.filter((p) => !recent.includes(p.ask));
  const choices = fresh.length ? fresh : pool;
  const chosen = choices[Math.floor(Math.random() * choices.length)];
  try {
    window.localStorage.setItem(recentKey, JSON.stringify([chosen.ask, ...recent].slice(0, Math.max(1, pool.length - 1))));
  } catch { /* ignore */ }
  const fill = (s: string) => s.replaceAll("{name}", name);
  return { ask: fill(chosen.ask), reply: chosen.reply };
}

/** Map the app's current screen (+ newsfeed tab) to a prompt pool key. */
export function coachPageKey(section: string, feedTab: string | null): string {
  const s = section.toLowerCase();
  if (s === "feed" || s === "newsfeed") return feedTab ?? "foryou";
  if (s === "home") return "home";
  if (s.includes("market")) return "market";
  if (s.includes("explore")) return "explore";
  if (s.includes("wallet")) return "wallet";
  return s || "default";
}
