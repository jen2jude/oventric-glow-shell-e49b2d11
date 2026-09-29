import { useEffect, useState } from "react";
import { ArrowRight, Download, Share, Plus, ShoppingBag, UsersRound, Wallet, Rocket, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isStandaloneDisplay } from "@/hooks/use-launch-context";
import {
  isAndroidDevice,
  isIosDevice,
  triggerInstall,
} from "@/lib/install-app";
import phoneHand from "@/assets/install-phone-hand-clean.png";
import appScreen from "@/assets/app-home-mock-screen.png";
import wordmark from "@/assets/oventric-logo-dark.png";

function AndroidMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M7.2 16.8c0 .66.54 1.2 1.2 1.2h.9v2.4a1.2 1.2 0 0 0 2.4 0V18h1.2v2.4a1.2 1.2 0 0 0 2.4 0V18h.3c.66 0 1.2-.54 1.2-1.2V9H7.2v7.8ZM5.4 9a1.2 1.2 0 0 0-1.2 1.2v4.8a1.2 1.2 0 0 0 2.4 0v-4.8A1.2 1.2 0 0 0 5.4 9Zm13.2 0a1.2 1.2 0 0 0-1.2 1.2v4.8A1.2 1.2 0 0 0 18.6 9Zm-3.42-3.36.84-1.26a.3.3 0 0 0-.5-.33l-.9 1.35a7.2 7.2 0 0 0-5.64 0l-.9-1.35a.3.3 0 1 0-.5.33l.84 1.26A6.6 6.6 0 0 0 7.2 8.4h9.6a6.6 6.6 0 0 0-1.62-2.76ZM10 6.9a.6.6 0 1 1 .6-.6.6.6 0 0 1-.6.6Zm4 0a.6.6 0 1 1 .6-.6.6.6 0 0 1-.6.6Z" />
    </svg>
  );
}

function AppleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.36 12.76c.03 3.06 2.68 4.08 2.71 4.09-.02.07-.42 1.45-1.4 2.87-.84 1.23-1.72 2.46-3.1 2.48-1.36.03-1.79-.8-3.34-.8-1.55 0-2.04.78-3.32.83-1.33.05-2.35-1.33-3.2-2.55C2.97 17.04 1.7 12.45 3.6 9.5a4.9 4.9 0 0 1 4.12-2.5c1.29-.02 2.5.87 3.29.87.79 0 2.27-1.07 3.83-.92.65.03 2.48.26 3.65 1.98-.09.06-2.18 1.28-2.16 3.83l.03-.01ZM14.16 5.2c.7-.85 1.18-2.04 1.05-3.2-1.02.04-2.25.68-2.98 1.53-.66.76-1.23 1.97-1.08 3.13 1.14.09 2.3-.58 3.01-1.46Z" />
    </svg>
  );
}

const benefits = [
  { title: "Shop", description: "Digital products from top creators", icon: ShoppingBag, color: "text-newsfeed-coral bg-newsfeed-coral-soft" },
  { title: "Connect", description: "Join a vibrant creator community", icon: UsersRound, color: "text-newsfeed-violet bg-newsfeed-violet-soft" },
  { title: "Earn", description: "Get cashback and rewards", icon: Wallet, color: "text-newsfeed-gold bg-newsfeed-gold-soft" },
  { title: "Create", description: "Showcase and sell your products", icon: Rocket, color: "text-newsfeed-green bg-newsfeed-green-soft" },
];

/** Website invitation only. Installed app stays unchanged. */
export function InstallAppSection() {
  const [hidden, setHidden] = useState(true);
  const [iosGuide, setIosGuide] = useState(false);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    if (isStandaloneDisplay()) return;
    setHidden(false);
  }, []);

  if (hidden) return null;

  const onInstall = async () => {
    if (isIosDevice()) {
      setIosGuide(true);
      setFallback(false);
      return;
    }
    const result = await triggerInstall();
    if (result === "unavailable") {
      setFallback(true);
      setIosGuide(false);
    }
  };

  return (
    <section aria-labelledby="install-app-title" className="home-install relative isolate overflow-hidden rounded-[10px] bg-home-surface px-5 py-9 text-home-ink sm:px-10 sm:py-12 lg:min-h-[620px] lg:px-12 lg:py-14 xl:min-h-[680px] xl:px-16">
      <div className="home-install-dots pointer-events-none absolute right-6 top-7 hidden h-24 w-24 opacity-50 lg:block" aria-hidden="true" />
      <div className="relative z-10 lg:max-w-[54%]">
        <img src={wordmark} alt="Oventric" width={280} height={90} loading="lazy" className="h-11 w-auto max-w-[200px] object-contain object-left sm:h-14 sm:max-w-[240px]" />
        <p className="mt-9 inline-flex items-center rounded-full bg-newsfeed-coral-soft px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-home-ink sm:mt-12">
          App now available
        </p>
        <h2 id="install-app-title" className="mt-5 font-wallet-display text-[clamp(2.35rem,4vw,4.2rem)] font-extrabold leading-[1.05] text-home-ink">
          Get the Oventric <span className="home-install-title-accent block">Mobile App</span>
        </h2>
        <p className="mt-4 max-w-[34rem] text-base leading-snug text-home-copy sm:text-lg lg:text-xl">
          Discover, shop, connect, create and earn — anytime, anywhere.
        </p>

        <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-4">
          {benefits.map(({ title, description, icon: Icon, color }) => (
            <div key={title} className="min-w-0 text-center">
              <span className={`mx-auto grid size-14 place-items-center rounded-[10px] sm:size-16 ${color}`}>
                <Icon className="size-7" strokeWidth={2.1} aria-hidden="true" />
              </span>
              <h3 className="mt-2 text-sm font-extrabold text-home-ink sm:text-base">{title}</h3>
              <p className="mx-auto mt-0.5 max-w-[9.5rem] text-xs leading-snug text-home-copy sm:text-[13px]">{description}</p>
            </div>
          ))}
        </div>

        <div className="mt-9 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
          <Button type="button" onClick={() => void onInstall()} className="home-install-cta h-auto min-h-16 w-full whitespace-normal rounded-full px-5 py-3 text-base font-bold sm:w-auto sm:min-w-[19rem] sm:text-lg">
            <Download className="!size-6" aria-hidden="true" />
            <span className="flex-1 text-left">Click here to download app to your phone</span>
            <ArrowRight className="!size-5" aria-hidden="true" />
          </Button>
          <div className="flex items-center gap-4 border-home-line sm:border-l sm:pl-5">
            <span className="text-xs leading-tight text-home-copy">Works on<br />your phone</span>
            <span className="flex items-center gap-2 text-home-ink" title="iOS"><AppleMark className="size-6" /><span className="text-sm font-semibold">iOS</span></span>
            <span className="flex items-center gap-2 text-newsfeed-green" title="Android"><AndroidMark className="size-6" /><span className="text-sm font-semibold text-home-ink">Android</span></span>
          </div>
        </div>

        {iosGuide && (
          <div className="mt-5 flex max-w-lg items-start justify-between gap-3 rounded-[10px] border border-home-line bg-newsfeed-canvas p-4 text-sm text-home-copy" role="status">
            <p>On iPhone, tap <Share className="inline size-4" aria-label="Share" /> Share in Safari, then <Plus className="inline size-4" aria-label="Add" /> Add to Home Screen.</p>
            <Button variant="ghost" size="icon-sm" type="button" aria-label="Close iPhone guide" onClick={() => setIosGuide(false)}><X /></Button>
          </div>
        )}
        {fallback && (
          <div className="mt-5 flex max-w-lg items-start justify-between gap-3 rounded-[10px] border border-home-line bg-newsfeed-canvas p-4 text-sm text-home-copy" role="status">
            <p>{isAndroidDevice() ? "Open oventric.com in Chrome on your Android phone and choose Install app from the browser menu." : "Open oventric.com on your phone. On iPhone, use Safari’s Share → Add to Home Screen; on Android, choose Install app in Chrome."}</p>
            <Button variant="ghost" size="icon-sm" type="button" aria-label="Close install guide" onClick={() => setFallback(false)}><X /></Button>
          </div>
        )}
      </div>
      <div className="pointer-events-none relative mx-auto mt-5 aspect-square w-full max-w-[480px] sm:max-w-[560px] lg:absolute lg:right-[-7%] lg:top-1/2 lg:h-full lg:w-auto lg:max-w-none lg:-translate-y-1/2" aria-hidden="true">
        <div className="home-install-ring absolute inset-[12%] rounded-full" />
        <AppleMark className="home-install-platform-mark absolute left-[6.5%] top-1/2 size-9 -translate-y-1/2 sm:size-12 lg:size-14" />
        <AndroidMark className="home-install-platform-mark absolute right-[6.5%] top-1/2 size-9 -translate-y-1/2 sm:size-12 lg:size-14" />
        <div className="relative h-full w-full lg:scale-[1.12]">
          <img src={phoneHand} alt="" width={1024} height={1024} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute overflow-hidden rounded-[9%/4%]" style={{ left: "38.97%", top: "15.43%", width: "21.09%", height: "48.15%" }}>
            <img src={appScreen} alt="" className="h-full w-full object-cover" />
          </div>
        </div>
      </div>
    </section>
  );
}
