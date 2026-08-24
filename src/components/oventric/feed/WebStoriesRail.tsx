import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { MAX_STORY_FILES, useStoryRail } from "@/components/oventric/feed/useStories";
import { StoryViewerModal } from "@/components/oventric/feed/StoryViewerModal";
import { StoryTrimmerModal } from "@/components/oventric/feed/StoryTrimmerModal";

const RINGS = [
  "from-[#E5484D] to-[#F59E0B]",
  "from-[#8B5CF6] to-[#E5484D]",
  "from-[#06B6D4] to-[#8B5CF6]",
  "from-[#F59E0B] to-[#E5484D]",
];

/** Stories rail for the browser/marketing feed — same data + viewer as the app. */
export function WebStoriesRail({
  meAvatarUrl,
  meInitials,
}: {
  meAvatarUrl?: string | null;
  meInitials?: string;
}) {
  const {
    groups,
    uploading,
    progress,
    upload,
    refresh,
    trimRequest,
    trimWorking,
    trimProgress,
    cancelTrim,
    confirmTrim,
  } = useStoryRail(true);
  const [viewerAt, setViewerAt] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  return (
    <section className="oventric-web">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-base font-black text-white md:text-slate-900">Stories</h2>
        <span className="text-[11px] text-slate-500">Leaves Stories after 24h · stays as a Reel</span>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []).slice(0, MAX_STORY_FILES);
            e.target.value = "";
            if (files.length) void upload(files);
          }}
        />
        <button
          type="button"
          onClick={() => !uploading && fileRef.current?.click()}
          className="flex w-[64px] shrink-0 flex-col items-center gap-1.5 transition-transform active:scale-95"
        >
          <span className="relative block h-[58px] w-[58px]">
            {uploading && (
              <span
                className="absolute inset-0 animate-spin rounded-full"
                style={{
                  background: `conic-gradient(#E5484D ${Math.round(progress * 360)}deg, rgba(0,0,0,0.10) 0deg)`,
                  animationDuration: "1.4s",
                }}
              />
            )}
            <span
              className={`absolute inset-0 overflow-hidden rounded-full bg-[#1A1A1F] ring-1 ring-black/10 ${
                uploading ? "m-[3px]" : ""
              }`}
            >
              <AvatarImage src={meAvatarUrl} alt="Add story" initials={meInitials ?? "Me"} />
            </span>
            {!uploading && (
              <span className="absolute -bottom-0.5 -right-0.5 z-10 grid h-[22px] w-[22px] place-items-center rounded-full border-2 border-white bg-[#E5484D]">
                <Plus className="h-3 w-3 text-white" strokeWidth={3} />
              </span>
            )}
          </span>
          <span className="w-full truncate text-center text-[11px] font-medium text-white/70 md:text-slate-600">
            {uploading ? "Uploading…" : "Add Story"}
          </span>
        </button>

        {groups.map((g, i) => (
          <button
            key={g.userId}
            type="button"
            onClick={() => setViewerAt(i)}
            className="flex w-[64px] shrink-0 flex-col items-center gap-1.5 transition-transform active:scale-95"
          >
            <span
              className={`grid h-[58px] w-[58px] place-items-center rounded-full p-[2px] ${
                g.allViewed ? "bg-black/15" : `bg-gradient-to-tr ${RINGS[i % RINGS.length]}`
              }`}
            >
              <span className="block h-full w-full overflow-hidden rounded-full border-2 border-white bg-[#1A1A1F]">
                <AvatarImage src={g.avatarUrl} alt={g.displayName} />
              </span>
            </span>
            <span className="w-full truncate text-center text-[11px] font-medium text-white/70 md:text-slate-600">
              {g.isMe ? "Your story" : g.displayName.split(" ")[0]}
            </span>
          </button>
        ))}
      </div>

      {viewerAt !== null && (
        <StoryViewerModal
          groups={groups}
          startIndex={viewerAt}
          onClose={() => {
            setViewerAt(null);
            void refresh();
          }}
        />
      )}
      {trimRequest && (
        <StoryTrimmerModal
          file={trimRequest.file}
          duration={trimRequest.duration}
          working={trimWorking}
          progress={trimProgress}
          onCancel={cancelTrim}
          onConfirm={(s) => void confirmTrim(s)}
        />
      )}
    </section>
  );
}
