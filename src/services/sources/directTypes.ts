// Shared shape for lots found directly on auction sites (before they become HuntMatch results).
export type DirectSite = 'drouot' | 'interencheres';

export interface DirectLot {
  site: DirectSite;
  id: string;
  url: string;
  title: string;
  description?: string;
  estimateLow?: number;
  estimateHigh?: number;
  /** Starting price (Drouot "Mise à prix" / online sales) when no estimate is published */
  startingPrice?: number;
  currency: string;
  /** Buyer's premium in %, incl. VAT, as published by the sale */
  premiumPct?: number;
  saleDate?: Date;
  saleType?: 'live' | 'online' | 'catalogue';
  /** True when only the sale DAY is known (search card shows dd/mm/yyyy) */
  dateOnly?: boolean;
  house?: string;
  houseId?: string;
  city?: string;
  /** Drouot country id (75 = France) when known */
  countryId?: number;
  image?: string;
  lotNumber?: number;
  soldOrEnded?: boolean;
  /** Set once the lot page / item JSON has been read */
  enriched?: boolean;
}
