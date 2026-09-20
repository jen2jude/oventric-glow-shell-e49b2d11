import { AvatarImage } from "@/components/oventric/AvatarImage";
import { CheckCircle2, Store } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { FollowButton } from "@/components/oventric/FollowButton";

interface PeopleExploreItemProps {
  userId: string;
  name: string;
  username: string;
  description?: string;
  avatarUrl: string | null;
  slug: string;
  isVerified?: boolean;
  hasActiveShop?: boolean;
}

export function PeopleExploreItem({
  userId,
  name,
  username,
  description,
  avatarUrl,
  slug,
  isVerified = false,
  hasActiveShop = false,
}: PeopleExploreItemProps) {
  // Fallback description for demo if missing
  const displayDescription = description || "Digital Creator • Oventric Hub";

  return (
    <article className="w-[190px] shrink-0 snap-start rounded-[10px] border border-white/[0.06] bg-[#141416] p-3">
      <Link
        to="/profile/$id"
        params={{ id: slug }}
        className="flex min-w-0 flex-col items-center text-center"
      >
        <div className="h-16 w-16 shrink-0 rounded-full overflow-hidden bg-[#1A1A1F] ring-1 ring-white/10">
          <AvatarImage src={avatarUrl} alt={name} />
        </div>
        <span className="mt-2 flex w-full min-w-0 items-center justify-center gap-1">
          <span className="text-[15px] font-bold text-white truncate group-active:text-[#E5484D] transition-colors leading-tight">
            {name}
          </span>
          {isVerified && (
            <CheckCircle2 className="h-3.5 w-3.5 fill-[#3897F0] text-[#0A0A0B]" />
          )}
        </span>
        <p className="text-[12px] text-white/40 leading-none">@{username || slug}</p>
        <p className="mt-1.5 h-10 text-[12px] text-white/70 line-clamp-2 leading-relaxed">
          {displayDescription}
        </p>
      </Link>

      <div className={`mt-3 grid gap-2 ${hasActiveShop ? "grid-cols-2" : "grid-cols-1"}`}>
        {hasActiveShop && (
          <Link
            to="/shop/$id"
            params={{ id: slug }}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-[8px] border border-white/20 bg-white/10 px-2 text-[11px] font-semibold text-white hover:bg-white/20"
          >
            <Store className="h-3.5 w-3.5" /> See shop
          </Link>
        )}
        <FollowButton targetId={userId} compact className="h-8 min-w-0 rounded-[8px] px-2 py-0 text-[11px]" />
      </div>
    </article>
  );
}

export function PeopleExploreList({ users }: { users: any[] }) {
  return (
    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto bg-[#0A0A0B] px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {users.map((user) => (
        <PeopleExploreItem
          key={user.id || user.user_id || user.userId}
          userId={user.user_id || user.userId || user.id}
          name={user.name || user.display_name}
          username={user.username || user.slug}
          description={user.description || user.bio}
          avatarUrl={user.avatarUrl || user.avatar_path}
          slug={user.slug}
          isVerified={user.is_verified || user.stars > 4.5}
          hasActiveShop={Boolean(user.hasActiveShop)}
        />
      ))}
    </div>
  );
}

