import { useIsAppShell } from "@/hooks/use-launch-context";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Star, Send, Loader2, MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { getProductRating, rateProduct, type ProductReview } from "@/lib/product-reviews.functions";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { COUNTRY_META } from "@/lib/currency/africa";
import { supabase } from "@/integrations/supabase/client";

export function ProductComments({ productId }: { productId: string }) {
  const isAppShell = useIsAppShell();
  const { require } = useOnboarding();
  const fetchRating = useServerFn(getProductRating);
  const submitReview = useServerFn(rateProduct);
  
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [average, setAverage] = useState(0);
  const [count, setCount] = useState(0);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [newComment, setNewComment] = useState("");
  const [rating, setRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (!cancelled) setUserId(uid);
      
      try {
        const r = await fetchRating({ data: { productId, userId: uid } });
        if (!cancelled) {
          setReviews(r.reviews);
          setAverage(r.average);
          setCount(r.count);
          setMyRating(r.myRating);
        }
      } catch (e) {
        console.error("Failed to load reviews", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [productId, fetchRating]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) {
      toast.error("Please enter a comment");
      return;
    }

    require(1, async () => {
      setSubmitting(true);
      try {
        const r = await submitReview({ 
          data: { productId, rating, comment: newComment } 
        });
        setReviews(r.reviews);
        setAverage(r.average);
        setCount(r.count);
        setMyRating(r.myRating);
        setNewComment("");
        toast.success("Review posted successfully!");
      } catch (err: any) {
        toast.error(err.message || "Failed to post review");
      } finally {
        setSubmitting(false);
      }
    }, "buyer");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className={`${isAppShell ? "mt-5 space-y-3 pb-6" : "mt-0 space-y-6 pb-12"}`}>
      <div className={`flex items-center justify-between border-b ${isAppShell ? "border-white/5" : "border-slate-200"} pb-2.5`}>
        <h2 className={`${isAppShell ? "text-[13px] font-black uppercase tracking-wider text-white/90" : "text-[15px] font-black text-slate-900"} flex items-center gap-2`}>
          Reviews ({count})
        </h2>
        <div className="flex items-center gap-1.5">
          <div className="flex text-amber-400">
            <Star className={isAppShell ? "w-3 h-3 fill-current" : "w-3.5 h-3.5 fill-current"} />
          </div>
          <span className={`font-black ${isAppShell ? "text-[12.5px] text-white" : "text-[15px] text-slate-900"}`}>{average.toFixed(1)}</span>
        </div>
      </div>

      {/* Write a review */}
      <div className={`${isAppShell ? "bg-white/[0.03] border-white/[0.05]" : "bg-white border-slate-200 shadow-sm"} border rounded-2xl p-4`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRating(s)}
                  className={`p-0.5 transition-transform active:scale-90 ${s <= rating ? "text-amber-400" : isAppShell ? "text-white/10" : "text-slate-200"}`}
                >
                  <Star className={`w-5 h-5 ${s <= rating ? 'fill-current' : ''}`} />
                </button>
              ))}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isAppShell ? "text-white/30" : "text-slate-400"}`}>
              {rating === 5 ? "Excellent" : rating === 4 ? "Very Good" : rating === 3 ? "Good" : rating === 2 ? "Fair" : "Poor"}
            </span>
          </div>
          
          <div className="relative">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write your experience..."
              className={`w-full ${isAppShell ? "bg-black/20 border-white/[0.05] text-white placeholder:text-white/20" : "bg-slate-50 border-slate-200 text-slate-900"} border rounded-xl p-3 text-[13px] focus:ring-1 focus:ring-[#E5484D]/50 outline-none min-h-[80px] resize-none transition-all`}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl ${isAppShell ? "bg-[#E5484D] text-white" : "bg-emerald-500 text-black"} font-black text-sm disabled:opacity-50 transition-all active:scale-[0.98]`}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {myRating ? "Update Review" : "Post Review"}
          </button>
        </form>
      </div>

      {/* Review list */}
      <div className="space-y-3">
        {reviews.length === 0 ? (
          <div className="text-center py-8 text-white/20 text-xs">
            No reviews yet.
          </div>
        ) : (
          reviews.map((rev) => (
            <div 
              key={rev.id} 
              className={`${isAppShell ? "bg-white/[0.02] border-white/[0.04]" : "bg-white border-slate-200 shadow-sm"} border rounded-2xl p-4`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-full overflow-hidden ${isAppShell ? "bg-white/5 border-white/10" : "bg-slate-100 border-slate-200"} border`}>
                    <AvatarImage src={rev.user.avatarUrl} alt={rev.user.fullName || "User"} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`font-bold text-[13px] ${isAppShell ? "text-white" : "text-slate-900"}`}>
                        {rev.user.fullName || "Anonymous User"}
                      </span>
                      {rev.user.country && COUNTRY_META[rev.user.country] && (
                        <span className="text-[10px]" title={COUNTRY_META[rev.user.country].name}>
                          {COUNTRY_META[rev.user.country].flag}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-white/30">
                      {format(new Date(rev.createdAt), "MMM d, yyyy")}
                    </div>
                  </div>
                </div>
                <div className="flex text-amber-400 gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star 
                      key={s} 
                      className={`w-2.5 h-2.5 ${s <= rev.rating ? 'fill-current' : 'text-white/5'}`} 
                    />
                  ))}
                </div>
              </div>
              <p className={`text-[13px] ${isAppShell ? "text-white/70" : "text-slate-600"} leading-snug whitespace-pre-wrap`}>
                {rev.comment}
              </p>
              {rev.sellerReply && (
                <div className={`mt-3 border-l-2 border-[#E5484D] pl-3 ${isAppShell ? "" : ""}`}>
                  <div className={`text-[10px] font-black uppercase tracking-wider ${isAppShell ? "text-white/40" : "text-slate-500"}`}>
                    Seller response
                  </div>
                  <p className={`mt-1 text-[13px] ${isAppShell ? "text-white/70" : "text-slate-600"} leading-snug whitespace-pre-wrap`}>
                    {rev.sellerReply}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
