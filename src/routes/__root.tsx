import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { OnboardingProvider } from "@/lib/onboarding/OnboardingContext";
import { StageModals } from "@/components/oventric/onboarding/StageModals";
import { AuthSeeder } from "@/components/oventric/AuthSeeder";
import { AuthGateProvider } from "@/lib/auth-gate/AuthGateProvider";

import { ProfileSetupModalHost } from "@/lib/onboarding/ProfileSetupModal";
import { KycGateProvider } from "@/lib/kyc-gate/KycGate";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { ReactivationGate } from "@/components/oventric/ReactivationGate";
import { GlobalMobileNav } from "@/components/oventric/GlobalMobileNav";
import { Toaster } from "@/components/ui/sonner";
import { ProfileSettingsLauncher } from "@/components/oventric/ProfileDropdown";
import { LiveNotificationToasts } from "@/components/oventric/LiveNotificationToasts";
import { PushOptInPrompt } from "@/components/oventric/PushOptInPrompt";
import { BootSplash } from "@/components/oventric/BootSplash";
import { AppShellGestures } from "@/components/oventric/pwa/AppShellGestures";
import { InstallPrompt } from "@/components/oventric/pwa/InstallPrompt";
import { UpdatePrompt } from "@/components/oventric/pwa/UpdatePrompt";

import { OfflineBanner } from "@/components/oventric/pwa/OfflineBanner";
import { registerAppServiceWorker } from "@/lib/pwa/register-sw";
import { initNativeShell } from "@/lib/native/capacitor";
import { initDeepLinks } from "@/lib/native/deep-links";

import { useLiveFx } from "@/lib/useLiveFx";
import { FeatureCarousel } from "@/components/oventric/FeatureCarousel";
import { useFirstLaunch } from "@/hooks/useFirstLaunch";
import { useLaunchContext } from "@/hooks/use-launch-context";
import { unlockNotificationSound } from "@/lib/notification-sound";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-[10px] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-[10px] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-[10px] border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

/** Media/storage origin used for early connection warming. */
const STORAGE_ORIGIN =
  (import.meta.env['VITE_SUPABASE_URL'] as string | undefined) ?? "";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#121214" },
      { name: "color-scheme", content: "dark" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { title: "Oventric — Marketplace, Academy, Bounties, and Wallet" },
      {
        name: "description",
        content: "Feed, marketplace, academy, bounties, and wallet — one platform for builders.",
      },
      { property: "og:title", content: "Oventric — Marketplace, Academy, Bounties, and Wallet" },
      {
        property: "og:description",
        content:
          "Join the multi-vendor tech platform. Marketplace, Academy, Bounties, and Secured Wallet all in one place.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Oventric" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Oventric — Marketplace, Academy, Bounties, and Wallet" },
      {
        name: "twitter:description",
        content:
          "Join the multi-vendor tech platform. Marketplace, Academy, Bounties, and Secured Wallet all in one place.",
      },
      { property: "og:image", content: "https://oventric.com/og-image.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:image", content: "https://oventric.com/og-image.jpg" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      // Warm the media/storage origin so the first image/video byte arrives sooner.
      ...(STORAGE_ORIGIN
        ? [
            { rel: "preconnect", href: STORAGE_ORIGIN, crossOrigin: "anonymous" as const },
            { rel: "dns-prefetch", href: STORAGE_ORIGIN },
          ]
        : []),

    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://oventric.com/#organization",
              name: "Oventric",
              url: "https://oventric.com/",
              logo: "https://oventric.com/icon-512.png",
              description:
                "Multi-vendor tech platform: social feed, marketplace, academy, bounties and a multi-currency escrow wallet.",
            },
            {
              "@type": "WebSite",
              "@id": "https://oventric.com/#website",
              name: "Oventric",
              url: "https://oventric.com/",
              publisher: { "@id": "https://oventric.com/#organization" },
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: "https://oventric.com/?q={search_term_string}",
                },
                "query-input": "required name=search_term_string",
              },
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" style={{ background: "#121214", colorScheme: "dark" }} suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          // Pre-paint GPU tier detection. Sets `html.high-gpu` for capable
          // devices (allow-list) or `html.low-gpu` for weak GPUs / reduced-motion.
          // Neither = safe UI default. Manual override:
          // localStorage['oventric:gpu-mode'] = 'high' | 'low'.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
  var d=document.documentElement;
  function markLow(r){d.classList.remove('high-gpu');d.classList.add('low-gpu');try{d.dataset.gpuTier='low';d.dataset.gpuReason=r||'';}catch(e){}}
  function markHigh(r){d.classList.remove('low-gpu');d.classList.add('high-gpu');try{d.dataset.gpuTier='high';d.dataset.gpuReason=r||'';}catch(e){}}
  var ov=null;try{ov=localStorage.getItem('oventric:gpu-mode');}catch(e){}
  if(ov==='low'){markLow('manual');return;}
  if(ov==='high'){markHigh('manual');return;}
  var reduce=false;try{reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){}
  if(reduce){markLow('reduced-motion');return;}
  var ua=navigator.userAgent||'';
  var isMobile=/Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  var isAndroid=/Android/i.test(ua);
  var isApple=/iPhone|iPad|iPod/i.test(ua);
  var weakDevice=/Infinix|X6813|X68\\d{2}|Note\\s*11i|TECNO|itel|Nokia\\s*C|Redmi\\s*(9|A)|Realme\\s*C/i.test(ua);
  var mem=navigator.deviceMemory||0;
  var cpu=navigator.hardwareConcurrency||0;
  var r='';
  try{
    var c=document.createElement('canvas');
    var gl=c.getContext('webgl')||c.getContext('experimental-webgl');
    if(gl){
      var ext=gl.getExtension('WEBGL_debug_renderer_info');
      r=ext?String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)||''):String(gl.getParameter(gl.RENDERER)||'');
    }
  }catch(e){}
  var highRe=/Adreno(?:\\s*\\(TM\\))?\\s*(6[2-9]\\d|7\\d\\d|8\\d\\d)|Apple\\s*(A1[2-9]|A[2-9]\\d|M[1-9])|Mali-?G(7[1-9]|8\\d|9\\d\\d?)|Immortalis-?G\\d+|Xclipse\\s*9[2-9]\\d/i;
  var lowRe=/Adreno(?:\\s*\\(TM\\))?\\s*(30\\d|40\\d|50\\d|51[0-2])|Mali-?T\\d+|Mali-?4\\d\\d|Mali-?G(3\\d|5[0-2]|57)\\b|PowerVR\\s*(G6|GE8|GX6|7XT)|Vivante|VideoCore/i;
  if(r && highRe.test(r)){markHigh('webgl-allow');return;}
  if(r && lowRe.test(r)){markLow('webgl-deny');return;}
  if(weakDevice){markLow('device');return;}
  if(!isMobile){markHigh('desktop');return;}
  if(isApple){markHigh('apple-mobile');return;}
  // Android heuristic score (WebGL renderer is often masked by Chrome).
  // Conservative rule: RAM/cores/resolution alone do NOT prove a premium GPU
  // (budget phones like Infinix Note 11i can report 8GB/8 cores). Only clear
  // flagship model/WebGL signals or a very strong modern-device score promote.
  if(isAndroid){
    var score=0, reasons=[];
    var am=(ua.match(/Android\\s+(\\d+)/i)||[])[1];
    var av=am?parseInt(am,10):0;
    if(av){
      if(av<=11){score-=2;reasons.push('android'+av);}
      else if(av===12){score-=1;reasons.push('android'+av);}
      else if(av>=14){score+=1;reasons.push('android'+av);}
    } else {score-=1;reasons.push('android?');}
    // Memory: <=4 GB is low, 6 GB neutral-low, 8 GB modest, 12+ GB strong.
    if(mem){
      if(mem<=4){score-=3;reasons.push('mem'+mem);}
      else if(mem<=6){score-=1;reasons.push('mem'+mem);}
      else if(mem>=12){score+=2;reasons.push('mem'+mem);}
      else if(mem>=8){score+=1;reasons.push('mem'+mem);}
    } else {score-=1;reasons.push('mem?');}
    // CPU cores.
    if(cpu){
      if(cpu<=4){score-=3;reasons.push('cpu'+cpu);}
      else if(cpu<=6){score-=1;reasons.push('cpu'+cpu);}
      else if(cpu>=8){score+=1;reasons.push('cpu'+cpu);}
    } else {score-=1;reasons.push('cpu?');}
    // Screen size + DPR: flagships are typically >=1080p logical (>=390 CSS w & DPR>=2.75).
    var dpr=window.devicePixelRatio||1;
    var sw=Math.max(screen.width||0,screen.height||0);
    var physW=sw*dpr;
    if(physW>=2400 && dpr>=3){score+=1;reasons.push('hdpi');}
    else if(physW<=1600 || dpr<2){score-=1;reasons.push('ldpi');}
    // Network: save-data or slow effective type → low.
    try{
      var conn=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
      if(conn){
        if(conn.saveData){score-=3;reasons.push('save-data');}
        var et=String(conn.effectiveType||'');
        if(et==='slow-2g'||et==='2g'||et==='3g'){score-=1;reasons.push(et);}
      }
    }catch(e){}
    // Touch-point ceiling (some entry-level chips report low): informative only.
    var mtp=navigator.maxTouchPoints||0;
    if(mtp && mtp<5){score-=1;reasons.push('tp'+mtp);}
    var veryStrongModern=(score>=5 && av>=13 && mem>=8 && cpu>=8);
    // Decision: require a very strong modern-device score for premium;
    // anything uncertain stays low/safe so overview cards shed heavy CSS.
    if(veryStrongModern){markHigh('android-score:'+score+'|'+reasons.join(','));}
    else{markLow('android-score:'+score+'|'+reasons.join(','));}
    // Async model check can still promote known flagships or demote known weak.
    try{
      var uad=navigator.userAgentData;
      if(uad&&uad.getHighEntropyValues){
        uad.getHighEntropyValues(['model','platform']).then(function(v){
          var m=String((v&&v.model)||'');
          if(/Pixel\\s*[7-9]|Pixel\\s*[1-9]\\d|SM-S\\d{2}|SM-F\\d{2}|SM-N\\d{3}|OnePlus\\s*(9|1\\d)|ASUS_AI|ROG|Xiaomi\\s*1[3-9]|22\\d{2}|23\\d{2}/i.test(m)){
            d.classList.remove('low-gpu');d.classList.add('high-gpu');try{d.dataset.gpuTier='high';d.dataset.gpuReason='model-flagship:'+m;}catch(e){}
          } else if(/Infinix|X6813|Note\\s*11i|TECNO|itel|Nokia\\s*C|Redmi\\s*(9|A)|Realme\\s*C/i.test(m)){
            d.classList.remove('high-gpu');d.classList.add('low-gpu');try{d.dataset.gpuTier='low';d.dataset.gpuReason='model-weak:'+m;}catch(e){}
          }
        }).catch(function(){});
      }
    }catch(e){}
    return;
  }
  // Non-Android mobile (rare fallthrough): be conservative.
  markLow('mobile-default');

}catch(e){}})();`,
          }}
        />
        <script
          // Optional GPU debug badge — activate with ?gpuDebug=1
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
  if(!/[?&]gpuDebug=1/.test(location.search))return;
  addEventListener('DOMContentLoaded',function(){
    var d=document.documentElement;
    var b=document.createElement('div');
    b.textContent='GPU: '+(d.dataset.gpuTier||'default')+' ('+(d.dataset.gpuReason||'-')+')';
    b.style.cssText='position:fixed;bottom:8px;left:8px;z-index:99999;background:#000c;color:#0f0;font:11px/1.2 monospace;padding:4px 6px;border-radius:4px;pointer-events:none';
    document.body.appendChild(b);
  });
}catch(e){}})();`,
          }}
        />
      </head>
      <body style={{ background: "#121214" }}>
        {/* Standalone-launch splash: mirrors the React BootSplash until hydration. */}
        <div id="oventric-boot" aria-hidden>
          <div className="ob-logo-container">
            <img
              src="/oventric-full-transparent.png"
              className="ob-wordmark"
              alt="Oventric"
              draggable={false}
            />
            <div className="ob-icons">
              <div className="ob-icon" style={{ "--c": "#ff4d6d" } as any}></div>
              <div className="ob-icon" style={{ "--c": "#ffb020" } as any}></div>
              <div className="ob-icon" style={{ "--c": "#22ff88" } as any}></div>
              <div className="ob-icon" style={{ "--c": "#00c2ff" } as any}></div>
              <div className="ob-icon" style={{ "--c": "#7aa2ff" } as any}></div>
              <div className="ob-icon" style={{ "--c": "#a855f7" } as any}></div>
            </div>
          </div>
          <style
            dangerouslySetInnerHTML={{
              __html: `#oventric-boot{position:fixed;inset:0;z-index:99998;display:none;flex-direction:column;align-items:center;justify-content:center;background:#121214;transition:opacity .3s}
#oventric-boot .ob-logo-container{display:flex;flex-direction:column;align-items:center;gap:16px}
#oventric-boot .ob-wordmark{height:40px;width:auto;user-select:none}
#oventric-boot .ob-icons{display:flex;gap:12px}
#oventric-boot .ob-icon{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.15);animation:ob-sweep 2.4s infinite ease-in-out}
#oventric-boot .ob-icon:nth-child(1){animation-delay:0s}
#oventric-boot .ob-icon:nth-child(2){animation-delay:0.15s}
#oventric-boot .ob-icon:nth-child(3){animation-delay:0.3s}
#oventric-boot .ob-icon:nth-child(4){animation-delay:0.45s}
#oventric-boot .ob-icon:nth-child(5){animation-delay:0.6s}
#oventric-boot .ob-icon:nth-child(6){animation-delay:0.75s}
@keyframes ob-sweep{
  0%,100%{transform:scale(1);opacity:0.2;background:rgba(255,255,255,0.15);box-shadow:none}
  50%{transform:scale(1.5);opacity:1;background:var(--c);box-shadow:0 0 12px var(--c)}
}`,
            }}
          />
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{
  var root=document.getElementById('oventric-boot');if(!root)return;
  var standalone=false;
  try{standalone=((window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true)&&window.matchMedia('(max-width: 767px)').matches;}catch(e){}
  window.__oventricStandalone=!!standalone;
  if(standalone){root.style.display='flex';}else{root.parentNode&&root.parentNode.removeChild(root);}
}catch(e){}})();`,
            }}
          />
        </div>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const appRouter = useRouter();

  const { show, markSeen, hydrated } = useFirstLaunch();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);
  // Welcome slides belong to the app shell (native build / installed PWA);
  // plain browser visitors get the marketing site instead.
  const launchCtx = useLaunchContext();
  const isAppShell = launchCtx === "native" || launchCtx === "standalone";
  // Welcome slides are a mobile-first onboarding experience; skip them on PC.
  const [isPc, setIsPc] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1024 : false,
  );
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsPc(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  // Keeps live FX rates fresh for every price conversion in the app.
  useLiveFx();

  // Browsers block audio until the user interacts; prime the chime engine once.
  useEffect(() => {
    const unlock = () => unlockNotificationSound();
    const opts = { once: true, passive: true } as const;
    window.addEventListener("pointerdown", unlock, opts);
    window.addEventListener("keydown", unlock, opts);
    window.addEventListener("touchstart", unlock, opts);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  // Offline app shell (production, non-preview contexts only).
  useEffect(() => {
    registerAppServiceWorker();
  }, []);

  // Mode switcher for preview environment
  const isPreview = typeof window !== "undefined" && (window.location.hostname.includes("lovable.app") || window.location.hostname.includes("lovableproject.com") || window.location.hostname === "localhost");
  const toggleMode = () => {
    const url = new URL(window.location.href);
    if (launchCtx === "browser") {
      url.searchParams.set("mode", "app");
    } else {
      url.searchParams.delete("mode");
    }
    window.location.href = url.toString();
  };

  // Native iOS / Android shell + deep links (no-op in the browser).
  useEffect(() => {
    void initNativeShell();
    let dispose: (() => void) | undefined;
    void initDeepLinks((path) => {
      void appRouter.navigate({ href: path });
    }).then((off) => {
      dispose = off;
    });
    return () => dispose?.();
  }, [appRouter]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthGateProvider>
          <OnboardingProvider>
            <KycGateProvider>
              <AuthSeeder />
              {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
              <Outlet />
              <StageModals />
              <ProfileSetupModalHost />
              <ProfileSettingsLauncher />

              <ReactivationGate />
              {!isAppShell ? null : <GlobalMobileNav />}
              <Toaster position="top-center" richColors closeButton />
              <LiveNotificationToasts />
              <PushOptInPrompt />
              <OfflineBanner />
              <AppShellGestures />
              <InstallPrompt />
              <UpdatePrompt />

              <BootSplash />
               {show && hydrated && !isPc && isAppShell && <FeatureCarousel onComplete={markSeen} />}
              
              {isPreview && isMounted && (
                <button
                  onClick={toggleMode}
                  className="fixed top-1/2 -translate-y-1/2 right-0 z-[9999] px-2 py-3 bg-emerald-500/90 text-black text-[9px] font-bold uppercase tracking-widest rounded-l-full shadow-2xl hover:scale-105 active:scale-95 transition-all border border-white/20 [writing-mode:vertical-rl]"
                >
                  {launchCtx === "browser" ? "View App Version" : "View Web Version"}
                </button>
              )}
            </KycGateProvider>
          </OnboardingProvider>
        </AuthGateProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
