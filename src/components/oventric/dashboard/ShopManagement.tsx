import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Camera, 
  Store, 
  Image as ImageIcon,
  Save,
  Loader2,
  CheckCircle2,
  Info
} from "lucide-react";
import { updateShopSettings } from "@/lib/dashboard/seller.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function ShopManagement() {
  const queryClient = useQueryClient();
  const updateSettingsFn = useServerFn(updateShopSettings);
  
  // We'll need the user's current profile to pre-fill the form
  const { data: user } = useSuspenseQuery({
    queryKey: ["current-user-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
      return data;
    }
  });

  const [shopName, setShopName] = useState(user?.shop_name || "");
  const [description, setDescription] = useState(user?.bio || "");
  const [about, setAbout] = useState(user?.shop_about || "");
  const [logoPath, setLogoPath] = useState(user?.shop_logo_path || user?.avatar_path || "");
  const [coverPath, setCoverPath] = useState(user?.shop_cover_path || user?.cover_path || "");
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"logo" | "cover" | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  // Resolve stored storage paths into viewable URLs for the existing images.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sign = async (bucket: "avatars" | "profile-covers", path: string) => {
        const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24);
        return data?.signedUrl ?? null;
      };
      if (logoPath && !logoPath.startsWith("blob:") && !logoPath.startsWith("http")) {
        const url = await sign("avatars", logoPath);
        if (!cancelled) setLogoPreview(url);
      }
      if (coverPath && !coverPath.startsWith("blob:") && !coverPath.startsWith("http")) {
        const url = await sign("profile-covers", coverPath);
        if (!cancelled) setCoverPreview(url);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only on first load of the stored paths.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickAndUpload = useCallback(
    async (file: File, kind: "logo" | "cover") => {
      if (!file.type.startsWith("image/")) {
        toast.error("Please choose an image file.");
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        toast.error("Image must be smaller than 8MB.");
        return;
      }
      setUploading(kind);
      const localUrl = URL.createObjectURL(file);
      if (kind === "logo") setLogoPreview(localUrl);
      else setCoverPreview(localUrl);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) throw new Error("Not authenticated");
        const bucket = kind === "logo" ? "avatars" : "profile-covers";
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${uid}/shop-${kind}-${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(bucket).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "image/jpeg",
        });
        if (error) throw error;
        if (kind === "logo") setLogoPath(path);
        else setCoverPath(path);
        toast.success(kind === "logo" ? "Shop logo uploaded" : "Cover image uploaded");
      } catch {
        toast.error("Could not upload that image. Please try again.");
        if (kind === "logo") setLogoPreview(null);
        else setCoverPreview(null);
      } finally {
        setUploading(null);
      }
    },
    [],
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettingsFn({
        data: {
          shopName,
          description,
          about,
          logoPath,
          coverPath
        }
      });
      toast.success("Shop settings updated successfully");
      queryClient.invalidateQueries({ queryKey: ["current-user-profile"] });
    } catch (e) {
      toast.error("Failed to update shop settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-white mb-1">Shop Customization</h3>
        <p className="text-sm text-slate-500">Manage your brand identity and shop appearance.</p>
      </div>

      <div className="space-y-6">
        {/* Visual Branding */}
        <div className="bg-[#141418] border border-white/10 rounded-2xl overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-[#E5484D]/20 to-purple-500/20 relative">
             {coverPreview ? (
               <img decoding="async" src={coverPreview} alt="Shop cover" className="absolute inset-0 h-full w-full object-cover" />
             ) : null}
             <div className="absolute inset-0 flex items-center justify-center">
               <button
                 type="button"
                 onClick={() => coverRef.current?.click()}
                 disabled={uploading !== null}
                 className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-black/50 text-white text-xs font-bold hover:bg-black/70 transition-colors disabled:opacity-60"
               >
                 {uploading === "cover" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                 Change Cover
               </button>
             </div>
          </div>
          <input
            ref={coverRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void pickAndUpload(f, "cover");
            }}
          />
          <div className="px-6 pb-6 relative">
            <div className="absolute -top-10 left-6">
              <button
                type="button"
                onClick={() => logoRef.current?.click()}
                disabled={uploading !== null}
                aria-label="Change shop logo"
                className="relative w-20 h-20 rounded-2xl bg-[#141418] border-4 border-[#141418] shadow-xl overflow-hidden flex items-center justify-center group cursor-pointer disabled:opacity-60"
              >
                {logoPreview ? (
                  <img decoding="async" src={logoPreview} alt="Shop logo" className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-8 h-8 text-slate-700" />
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  {uploading === "logo" ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4 text-white" />
                  )}
                </div>
              </button>
              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void pickAndUpload(f, "logo");
                }}
              />
            </div>
            
            <div className="pt-14 space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1.5">Shop Name</label>
                <input 
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="Your Shop Name"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#E5484D]/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1.5">Short Description</label>
                <input 
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="One-liner about your shop"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#E5484D]/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1.5">About Section</label>
                <textarea 
                  rows={4}
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  placeholder="Tell customers more about what you do..."
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#E5484D]/50 transition-colors resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl">
          <div className="flex items-center gap-2 text-slate-400">
            <Info className="w-4 h-4" />
            <span className="text-xs">Your shop changes will be visible on your profile.</span>
          </div>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black text-sm font-bold hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
