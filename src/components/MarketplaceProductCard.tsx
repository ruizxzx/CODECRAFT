import React, { useEffect, useRef, useState } from 'react';
import { Heart, Package, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { CommerceProduct, CommercePublicPrice } from '../lib/commerce';
import { recordMarketplaceEvent } from '../lib/marketplace';

interface Props {
  product: CommerceProduct;
  price?: CommercePublicPrice;
  owned?: boolean;
  saved?: boolean;
  onOpen: (productId: string) => void;
  onToggleSave?: (product: CommerceProduct) => void;
  compact?: boolean;
}

const money = (amount: number, currency: string) => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format((Number(amount) || 0) / 100); }
  catch { return `${currency} ${((Number(amount) || 0) / 100).toFixed(2)}`; }
};

export const MarketplaceProductCard: React.FC<Props> = ({ product, price, owned = false, saved = false, onOpen, onToggleSave, compact = false }) => {
  const cover = product.thumbnail || product.gallery?.find(Boolean) || '';
  const [imageFailed, setImageFailed] = useState(false);
  const cardRef = useRef<HTMLElement | null>(null);
  const impressionSent = useRef(false);
  useEffect(() => {
    if (impressionSent.current || typeof window === 'undefined') return;
    const node = cardRef.current;
    if (!node || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some(entry => entry.isIntersecting) || impressionSent.current) return;
      impressionSent.current = true;
      recordMarketplaceEvent('product_impression', product.id, { source: 'product-card' });
      observer.disconnect();
    }, { threshold: 0.35, rootMargin: '120px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [product.id]);
  useEffect(() => { setImageFailed(false); }, [cover]);
  return <article ref={cardRef} id={`marketplace-product-${product.id}`} className={`group border-4 border-black bg-white overflow-hidden transition-transform hover:-translate-y-1 hover:shadow-[6px_6px_0_#000] ${compact ? '' : 'h-full'}`}>
    <div className="relative">
      <button className="block w-full text-left" onClick={() => onOpen(product.id)} aria-label={`Open ${product.title}`}>
        <div className="aspect-[4/3] bg-neutral-100 overflow-hidden border-b-4 border-black">
          {cover && !imageFailed ? <img src={cover} alt={`${product.title} preview`} loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.025]" onError={() => setImageFailed(true)} /> : <div className="w-full h-full flex flex-col items-center justify-center gap-2"><Package className="w-10 h-10" aria-hidden="true"/><span className="font-mono text-[8px] font-black uppercase text-neutral-500">PRODUCT PREVIEW</span></div>}
        </div>
      </button>
      {onToggleSave && <button type="button" aria-label={saved ? `Remove ${product.title} from saved products` : `Save ${product.title}`} onClick={() => onToggleSave(product)} className={`absolute top-3 right-3 w-10 h-10 border-2 border-black flex items-center justify-center ${saved ? 'bg-[var(--color-primary)]' : 'bg-white'} shadow-[3px_3px_0_#000] hover:bg-[var(--color-secondary)]`}>
        <Heart className={`w-4 h-4 ${saved ? 'fill-current' : ''}`} aria-hidden="true"/>
      </button>}
      {product.featured && <span className="absolute left-3 top-3 border-2 border-black bg-[var(--color-primary)] px-2 py-1 font-mono text-[8px] font-black uppercase">FEATURED</span>}
    </div>
    <div className="p-4 flex flex-col min-h-[210px]">
      <div className="flex items-center justify-between gap-2 font-mono text-[8px] font-black uppercase text-neutral-500">
        <span><Package className="inline w-3 h-3 mr-1"/>{String(product.subtype || product.type || 'PRODUCT').replaceAll('_', ' ')}</span>
        {owned && <span className="text-black"><CheckCircle2 className="inline w-3 h-3 mr-1"/>OWNED</span>}
      </div>
      <button className="text-left mt-3" onClick={() => onOpen(product.id)}>
        <h3 className="font-display font-black text-2xl uppercase leading-[0.95] break-words">{product.title}</h3>
        {product.subtitle && <p className="font-mono text-[9px] text-neutral-500 mt-2 line-clamp-2">{product.subtitle}</p>}
      </button>
      <div className="mt-auto pt-4 flex items-end justify-between gap-2">
        <div className="font-display font-black text-2xl">{price ? money(price.amount, price.currency) : 'PRICE UNAVAILABLE'}</div>
        <button onClick={() => onOpen(product.id)} className="font-mono text-[8px] font-black uppercase inline-flex items-center gap-1 border-2 border-black px-2 py-2 hover:bg-[var(--color-primary)]">{owned ? 'VIEW' : 'VIEW'} <ArrowRight className="w-3 h-3"/></button>
      </div>
    </div>
  </article>;
};
