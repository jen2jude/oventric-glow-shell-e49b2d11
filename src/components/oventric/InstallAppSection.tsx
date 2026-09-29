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


function AppStoreTile({ className }: { className?: string }) {
  return (
    <span className={`home-install-os-tile grid place-items-center rounded-[22%] bg-home-surface ${className ?? ""}`}>
      <svg viewBox="0 0 64 64" className="h-[62%] w-[62%]" aria-hidden="true">
        <defs><linearGradient id="ov-as" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#18BFFB" /><stop offset="1" stopColor="#2072F3" /></linearGradient></defs>
        <rect width="64" height="64" rx="15" fill="url(#ov-as)" />
        <g stroke="#fff" strokeWidth="4.2" strokeLinecap="round" fill="none">
          <path d="M36 14 22 40" /><path d="M28 14l14 26" /><path d="M16 40h32" /><path d="M19 47l-2.5 4" /><path d="M44 45l3.5 6" />
        </g>
      </svg>
    </span>
  );
}

function PlayStoreTile({ className }: { className?: string }) {
  return (
    <span className={`home-install-os-tile grid place-items-center rounded-[22%] bg-home-surface ${className ?? ""}`}>
      <svg viewBox="0 0 64 64" className="h-[58%] w-[58%]" aria-hidden="true">
        <path d="M10 5l30 27L10 59c-1.5-.7-2.5-2.2-2.5-4V9c0-1.8 1-3.3 2.5-4Z" fill="#00D7FE" />
        <path d="M10 5c1.2-.6 2.8-.5 4.1.2L48 24l-8 8Z" fill="#00F076" />
        <path d="M10 59l30-27 8 8-33.9 18.8c-1.3.7-2.9.8-4.1.2Z" fill="#F83A4B" />
        <path d="M48 24l7.4 4.1c3 1.7 3 6.1 0 7.8L48 40l-8-8Z" fill="#FFC800" />
      </svg>
    </span>
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
    <section aria-labelledby="install-app-title" className="home-install relative isolate overflow-hidden rounded-[10px] bg-home-surface px-5 py-8 text-home-ink sm:px-10 sm:py-10 lg:mt-40 lg:overflow-visible lg:px-12 lg:py-9 xl:px-14">
      <div className="home-install-dots pointer-events-none absolute right-6 top-7 hidden h-24 w-24 opacity-50 lg:block" aria-hidden="true" />
      <div className="relative z-10 lg:max-w-[50%]">
        <img src={wordmark} alt="Oventric" width={280} height={90} loading="lazy" className="h-10 w-auto max-w-[180px] lg:hidden object-contain object-left sm:h-11 sm:max-w-[200px]" />
        <p className="mt-6 lg:mt-0 inline-flex items-center rounded-full bg-newsfeed-coral-soft px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-home-ink sm:mt-7">
          App now available
        </p>
        <h2 id="install-app-title" className="mt-5 font-wallet-display text-[clamp(2.2rem,3vw,3rem)] lg:mt-4 font-extrabold leading-[1.05] text-home-ink">
          Get the Oventric <span className="home-install-title-accent block">Mobile App</span>
        </h2>
        <p className="mt-4 max-w-[34rem] text-base leading-snug text-home-copy sm:text-lg">
          Discover, shop, connect, create and earn — anytime, anywhere.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4 sm:gap-x-4 lg:mt-5 lg:gap-y-0">
          {benefits.map(({ title, description, icon: Icon, color }) => (
            <div key={title} className="min-w-0 text-center">
              <span className={`mx-auto grid size-12 place-items-center rounded-[10px] sm:size-14 lg:size-11 ${color}`}>
                <Icon className="size-7" strokeWidth={2.1} aria-hidden="true" />
              </span>
              <h3 className="mt-2 text-sm font-extrabold text-home-ink sm:text-base">{title}</h3>
              <p className="mx-auto mt-0.5 max-w-[9.5rem] text-xs leading-snug text-home-copy sm:text-[13px] lg:hidden">{description}</p>
            </div>
          ))}
        </div>

        <div className="mt-7 lg:mt-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
          <Button type="button" onClick={() => void onInstall()} className="home-install-cta h-auto min-h-16 w-full whitespace-normal rounded-full px-5 py-3 text-base font-bold sm:w-auto sm:min-w-[19rem] sm:text-lg">
            <Download className="!size-6" aria-hidden="true" />
            <span className="flex-1 text-left">Click here to download app to your phone</span>
            <ArrowRight className="!size-5" aria-hidden="true" />
          </Button>
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
      <div className="home-install-visual pointer-events-none relative mx-auto mt-5 aspect-square w-full max-w-[480px] sm:max-w-[540px] lg:absolute lg:bottom-0 lg:right-[1%] lg:mt-0 lg:h-[150%] lg:w-auto lg:max-w-none" aria-hidden="true">
        <div className="home-install-ring absolute inset-[12%] rounded-full" />
        <div className="home-install-hand relative h-full w-full">
          <img src={phoneHand} alt="" width={1024} height={1024} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute overflow-hidden rounded-[9%/4%]" style={{ left: "38.97%", top: "15.43%", width: "21.09%", height: "48.15%" }}>
            <img src={appScreen} alt="" className="h-full w-full object-cover" />
          </div>
        </div>
        <AppStoreTile className="home-install-os home-install-os-left absolute left-[12%] top-[46%] size-16 sm:size-20 lg:size-24" />
        <PlayStoreTile className="home-install-os home-install-os-right absolute right-[12%] top-[40%] size-16 sm:size-20 lg:size-24" />
      </div>
    </section>
  );
}
