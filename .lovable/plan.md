# Product Card Cashback Labels

## Goal
Show shoppers the exact cashback percentage on product cards before opening a product.

## Changes
- Add a compact `X% cashback` label to product cards on Home, Marketplace, Explore, storefronts, and other active product browsing surfaces.
- Show the label only when the product has cashback above 0%; do not imply cashback where none is configured.
- Use the existing server-provided cashback percentage, capped by the current 50% rule.
- Keep labels readable on small phone cards without covering product names, prices, stock, or seller details.

## Technical details
- Reuse `ProductDTO.cashbackPct` on marketplace-backed cards.
- Extend storefront listing data to carry `cashback_pct` where that card currently receives the reduced `ProfileListing` shape.
- Preserve all pricing, checkout, and seller-funded cashback calculations unchanged; this is a display-only change.
- Verify the Home and Marketplace cards at the current mobile viewport and confirm pages render without errors.
