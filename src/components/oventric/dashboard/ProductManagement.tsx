import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Pencil, 
  Trash2, 
  Eye, 
  EyeOff,
  Package,
  PackageX,
  PackageCheck,
  ExternalLink
} from "lucide-react";
import { listMyProducts, type ProductDTO } from "@/lib/marketplace.functions";
import { toggleProductStatus, deleteProduct, setProductStock } from "@/lib/dashboard/seller.functions";
import { toast } from "sonner";
import { EditListingModal } from "@/components/oventric/EditListingModal";
import { SellSwitcherModal } from "@/components/oventric/SellSwitcherModal";
import { Link } from "@tanstack/react-router";

export function ProductManagement() {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ProductDTO | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const fetchProducts = useServerFn(listMyProducts);
  const toggleStatusFn = useServerFn(toggleProductStatus);
  const deleteFn = useServerFn(deleteProduct);
  const stockFn = useServerFn(setProductStock);

  const { data: products } = useSuspenseQuery({
    queryKey: ["my-products"],
    queryFn: () => fetchProducts({}),
  });

  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggleStatus = async (productId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "pending" : "active";
    try {
      await toggleStatusFn({ data: { productId, status: newStatus as any } });
      toast.success(`Product ${newStatus === "active" ? "published" : "unpublished"}`);
      queryClient.invalidateQueries({ queryKey: ["my-products"] });
    } catch (e) {
      toast.error("Failed to update status");
    }
  };

  const handleToggleStock = async (productId: string, inStock: boolean) => {
    try {
      await stockFn({ data: { productId, inStock: !inStock } });
      toast.success(!inStock ? "Marked as in stock" : "Marked as out of stock");
      queryClient.invalidateQueries({ queryKey: ["my-products"] });
    } catch (e) {
      toast.error("Failed to update stock");
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      const res = await deleteFn({ data: { productId } });
      if (res.archived) {
        toast.info("Product has orders and was archived instead of deleted.");
      } else {
        toast.success("Product deleted");
      }
      queryClient.invalidateQueries({ queryKey: ["my-products"] });
    } catch (e) {
      toast.error("Failed to delete product");
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-[#E5484D]/50 transition-colors"
          />
        </div>
        <button 
          onClick={() => setCreateOpen(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#E5484D] text-white text-sm font-bold hover:bg-[#E5484D]/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Product
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((product) => (
          <div 
            key={product.id}
            className="group relative bg-[#141418] border border-white/10 rounded-2xl p-4 hover:border-white/20 transition-all"
          >
            <div className="flex gap-4">
              <div className="w-20 h-20 rounded-xl overflow-hidden bg-white/5 shrink-0 border border-white/5">
                {product.coverUrl ? (
                  <img loading="lazy" decoding="async" src={product.coverUrl} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-8 h-8 text-slate-700" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-white font-bold truncate">{product.name}</h4>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mt-0.5">
                      {product.category} {product.kind !== "digital" && `· ${product.kind}`}
                    </p>
                  </div>
                  <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    product.status === "active" ? "bg-emerald-500/10 text-emerald-400" : 
                    product.status === "pending" ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"
                  }`}>
                    {product.status}
                  </div>
                </div>
                {product.inStock === false && (
                  <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#E5484D]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#E5484D]">
                    <PackageX className="h-3 w-3" /> Out of stock
                  </div>
                </div>
                
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-sm font-black text-white">${product.priceUSD.toFixed(2)}</span>
                  <span className="text-[11px] text-slate-500">
                    {product.salesCount || 0} Sales
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setEditing(product)}
                  className="p-2 rounded-[10px] hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                  title="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleToggleStatus(product.id, product.status)}
                  className="p-2 rounded-[10px] hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                  title={product.status === "active" ? "Unpublish" : "Publish"}
                >
                  {product.status === "active" ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <Link
                  to="/product/$id"
                  params={{ id: product.id }}
                  className="p-2 rounded-[10px] hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                  title="View on Store"
                >
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </div>
              
              <button 
                onClick={() => handleDelete(product.id)}
                className="p-2 rounded-[10px] hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white/5 border border-dashed border-white/10 rounded-2xl">
            <Package className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No products found</p>
          </div>
        )}
      </div>

      {editing && (
        <EditListingModal 
          product={editing} 
          onClose={() => setEditing(null)} 
          onResubmitted={() => {
            setEditing(null);
            queryClient.invalidateQueries({ queryKey: ["my-products"] });
          }}
        />
      )}

      <SellSwitcherModal 
        open={createOpen} 
        onClose={() => setCreateOpen(false)} 
      />
    </div>
  );
}
