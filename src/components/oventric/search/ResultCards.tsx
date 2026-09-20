import { Link, useNavigate } from "@tanstack/react-router";
import { 
  User, 
  CheckCircle2, 
  ShoppingBag, 
  Store, 
  Star, 
  MessageSquare, 
  ArrowRight,
  Target,
  GraduationCap,
  Briefcase
} from "lucide-react";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { CashbackBadge } from "@/components/oventric/CashbackBadge";
import { 
  SearchResultPeer, 
  SearchResultProduct, 
  SearchResultShop, 
  SearchResultService, 
  SearchResultCourse,
  SearchResultPost
} from "@/lib/search.functions";

interface BaseCardProps {
    onClick?: () => void;
    className?: string;
}

export function PersonCard({ peer, onClick }: { peer: SearchResultPeer } & BaseCardProps) {
    return (
        <div className="flex items-start gap-3 py-4 border-b border-white/[0.06] last:border-0 px-4 active:bg-white/[0.02] transition-colors rounded-[10px]">
            <Link to="/profile/$id" params={{ id: peer.slug }} className="relative shrink-0">
                <div className="h-12 w-12 rounded-full overflow-hidden bg-[#1A1A1F] ring-1 ring-white/10">
                    <AvatarImage src={peer.avatarUrl} alt={peer.name} />
                </div>
            </Link>

            <div className="flex-1 min-w-0 py-0.5">
                <Link to="/profile/$id" params={{ id: peer.slug }} className="flex items-center gap-1 group">
                    <span className="text-[15px] font-bold text-white truncate group-active:text-[#E5484D] transition-colors leading-tight">
                        {peer.name}
                    </span>
                    {peer.stars > 4.5 && (
                        <CheckCircle2 className="h-3.5 w-3.5 fill-[#3897F0] text-[#0A0A0B]" />
                    )}
                </Link>
                <p className="text-[12px] text-white/40 leading-none">@{peer.username || peer.slug}</p>
                
                {peer.description && (
                    <p className="mt-1.5 text-[13px] text-white/70 line-clamp-2 leading-relaxed">
                        {peer.description}
                    </p>
                )}

                <div className="mt-2.5 flex flex-wrap gap-2">
                    {peer.hasShop && (
                        <Link 
                            to="/shop/$id" 
                            params={{ id: peer.slug }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/10 text-[10px] font-bold text-white/60 hover:text-white transition-colors"
                        >
                            <Store className="w-3 h-3" /> Shop
                        </Link>
                    )}
                    {peer.hasServices && (
                        <Link 
                            to="/profile/$id" 
                            params={{ id: peer.slug }}
                            search={{ tab: 'services' }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/10 text-[10px] font-bold text-white/60 hover:text-white transition-colors"
                        >
                            <Briefcase className="w-3 h-3" /> Services
                        </Link>
                    )}
                </div>
            </div>

            <Link
                to="/profile/$id"
                params={{ id: peer.slug }}
                className="shrink-0 h-8 px-4 rounded-full bg-[#E5484D] text-white text-[12px] font-bold flex items-center justify-center active:scale-95 transition-transform"
            >
                View
            </Link>
        </div>
    );
}

export function SearchProductCard({ product }: { product: SearchResultProduct }) {
    return (
        <Link
            to="/product/$id"
            params={{ id: product.id }}
            className="group overflow-hidden rounded-[10px] border border-white/[0.06] bg-[#141416] active:scale-[0.98] transition-transform"
        >
            <div className="relative h-32 w-full overflow-hidden bg-[#1A1A1F]">
                {product.coverUrl ? (
                    <img loading="lazy" decoding="async" src={product.coverUrl} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                    <div className="h-full w-full bg-white/[0.02] flex items-center justify-center">
                        <ShoppingBag className="w-8 h-8 text-white/10" />
                    </div>
                )}
                <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-black text-white">
                    {product.category}
                </div>
                <CashbackBadge percentage={product.cashbackPct} className="absolute bottom-2 left-2" />
            </div>
            <div className="p-3">
                <p className="line-clamp-2 text-[13px] font-bold text-white leading-tight h-8">{product.title}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[14px] font-black text-[#E5484D]">
                        ${product.priceUsd.toLocaleString()}
                    </p>
                    {product.sellerSlug && (
                        <span className="text-[10px] text-white/40 truncate max-w-[60px]">
                            by {product.vendor}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    );
}

export function ShopCard({ shop }: { shop: SearchResultShop }) {
    return (
        <Link
            to="/shop/$id"
            params={{ id: shop.slug }}
            className="flex items-center gap-4 p-4 rounded-[10px] border border-white/[0.06] bg-[#141416] active:bg-white/[0.04] transition-colors"
        >
            <div className="h-14 w-14 rounded-[10px] overflow-hidden bg-[#1A1A1F] ring-1 ring-white/10 shrink-0">
                <AvatarImage src={shop.avatarUrl} alt={shop.name} />
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="text-[15px] font-bold text-white truncate leading-tight">{shop.name}</h4>
                <div className="mt-1 flex items-center gap-3">
                    <span className="text-[11px] text-white/40 flex items-center gap-1">
                        <ShoppingBag className="w-3 h-3" /> {shop.productCount} items
                    </span>
                    <span className="text-[11px] text-white/40 flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> {shop.stars.toFixed(1)}
                    </span>
                </div>
            </div>
            <div className="text-right shrink-0">
                <div className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">Top Seller</div>
                <div className="mt-0.5 text-[12px] font-bold text-white/60">{shop.salesCount} sales</div>
            </div>
        </Link>
    );
}

export function ServiceCard({ service }: { service: SearchResultService }) {
    return (
        <Link
            to="/product/$id"
            params={{ id: service.id }}
            className="flex items-center gap-4 p-3 rounded-[10px] border border-white/[0.06] bg-[#141416] active:bg-white/[0.04] transition-colors"
        >
            <div className="h-14 w-14 rounded-[10px] overflow-hidden bg-[#1A1A1F] shrink-0">
                {service.coverUrl ? (
                    <img loading="lazy" decoding="async" src={service.coverUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                    <div className="h-full w-full flex items-center justify-center bg-rose-500/10">
                        <Briefcase className="w-6 h-6 text-rose-500" />
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="text-[14px] font-bold text-white line-clamp-2 leading-tight">{service.title}</h4>
                <p className="mt-1 text-[11px] text-white/40">Provider: {service.providerName}</p>
            </div>
            <div className="text-right shrink-0 pl-2">
                <div className="text-[10px] text-white/40 uppercase font-black">Starting at</div>
                <div className="text-[14px] font-black text-[#E5484D]">${service.priceUsd}</div>
            </div>
        </Link>
    );
}

export function CourseCard({ course }: { course: SearchResultCourse }) {
    return (
        <Link
            to="/product/$id"
            params={{ id: course.id }}
            className="flex flex-col rounded-[10px] border border-white/[0.06] bg-[#141416] overflow-hidden active:scale-[0.98] transition-transform"
        >
            <div className="relative aspect-video w-full bg-[#1A1A1F]">
                {course.coverUrl ? (
                    <img loading="lazy" decoding="async" src={course.coverUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                    <div className="h-full w-full flex items-center justify-center bg-violet-500/10">
                        <GraduationCap className="w-8 h-8 text-violet-500" />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-2 left-3 flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full overflow-hidden bg-white/20">
                         {/* We'd need creator avatar here ideally */}
                         <User className="w-3 h-3 text-white/40 m-auto" />
                    </div>
                    <span className="text-[10px] font-bold text-white/90 truncate">{course.creatorName}</span>
                </div>
            </div>
            <div className="p-3">
                <h4 className="text-[13px] font-bold text-white line-clamp-2 leading-tight">{course.title}</h4>
                <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest">Course</span>
                    <span className="text-[11px] font-bold text-white/40 flex items-center gap-1">
                        Enroll <ArrowRight className="w-3 h-3" />
                    </span>
                </div>
            </div>
        </Link>
    );
}
