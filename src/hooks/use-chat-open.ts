import { useEffect, useState } from "react";

const EVENT = "oventric:chat-open";

/** Marks the chat drawer as open/closed app-wide. */
export function setChatOpen(open: boolean) {
  if (typeof window === "undefined") return;
  (window as unknown as { __oventricChatOpen?: boolean }).__oventricChatOpen = open;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { open } }));
}

/** True while a chat drawer is open — used to hide the mobile bottom nav. */
export function useChatOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(Boolean((window as unknown as { __oventricChatOpen?: boolean }).__oventricChatOpen));
    const handler = (e: Event) => setOpen(Boolean((e as CustomEvent).detail?.open));
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);
  return open;
}
