/** Tracks which newsfeed tab is showing so the app's + button can pick the right create flow. */
let currentFeedTab: string | null = null;

export function setCurrentFeedTab(tab: string | null) {
  currentFeedTab = tab;
}

export function getCurrentFeedTab() {
  return currentFeedTab;
}
