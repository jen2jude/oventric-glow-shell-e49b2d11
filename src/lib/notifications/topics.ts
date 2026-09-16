/**
 * Shared notification topic taxonomy. Mirrors the SQL helper
 * `public.notif_topic_for_kind()` so client and server agree on which
 * notification family a `notifications.kind` belongs to.
 */
export const NOTIFICATION_TOPICS = [
  "messages",
  "bounties",
  "posts",
  "marketplace",
  "wallet",
  "academy",
  "system",
] as const;

export type NotificationTopic = (typeof NOTIFICATION_TOPICS)[number];

export const TOPIC_META: Record<
  NotificationTopic,
  { label: string; description: string }
> = {
  messages: {
    label: "Messages",
    description: "Direct chats from other members",
  },
  bounties: {
    label: "Bounties",
    description: "Applications, deliveries, releases and refunds",
  },
  posts: {
    label: "Posts & social",
    description: "Comments, reactions, follows and circle activity",
  },
  marketplace: {
    label: "Marketplace",
    description: "Orders, sales, deliveries and disputes",
  },
  wallet: {
    label: "Wallet & payouts",
    description: "Top-ups, cashback, payouts and transfers",
  },
  academy: {
    label: "Academy",
    description: "Course enrolments and progress updates",
  },
  system: {
    label: "Announcements",
    description: "Support replies and platform announcements",
  },
};

export function topicForKind(kind: string): NotificationTopic {
  const k = (kind ?? "").toLowerCase();
  if (k === "direct_message") return "messages";
  if (k.startsWith("bounty")) return "bounties";
  if (
    k.startsWith("post") ||
    k.startsWith("comment") ||
    k.startsWith("like") ||
    k.startsWith("follow") ||
    k.startsWith("circle")
  )
    return "posts";
  if (
    k.startsWith("order") ||
    k.startsWith("product") ||
    k.startsWith("sale") ||
    k.startsWith("dispute")
  )
    return "marketplace";
  if (k.startsWith("payout") || k.startsWith("wallet") || k.startsWith("cashback"))
    return "wallet";
  if (k.startsWith("course") || k.startsWith("academy") || k.startsWith("enrol"))
    return "academy";
  return "system";
}

export type TopicPrefs = Record<NotificationTopic, { inApp: boolean; push: boolean }>;

export function defaultTopicPrefs(): TopicPrefs {
  return NOTIFICATION_TOPICS.reduce((acc, t) => {
    acc[t] = { inApp: true, push: true };
    return acc;
  }, {} as TopicPrefs);
}

export function isNotificationTopic(value: string): value is NotificationTopic {
  return (NOTIFICATION_TOPICS as readonly string[]).includes(value);
}

/**
 * Topics surfaced in the current MVP. Bounties and Academy are preserved in
 * the taxonomy (backend + history) but are not part of the live product, so
 * they are not offered as user-facing preferences.
 */
export const MVP_NOTIFICATION_TOPICS = NOTIFICATION_TOPICS.filter(
  (t) => t !== "bounties" && t !== "academy",
);
