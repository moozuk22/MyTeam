export interface PartnerDiscount {
  id: string;
  name: string;
  logoUrl: string | null;
  badgeText: string | null;
  description: string | null;
  code: string | null;
  validUntil: string | null;
  storeUrl: string | null;
  terms: string[];
  themeColor: string | null;
}

export interface TeamConfig {
  discountId: string;
  teamGroup: number;
  order: number;
  isVisible: boolean;
  discount?: PartnerDiscount;
}

export interface Team {
  clubId: string;
  teamGroup: number;
  clubName: string;
  clubLogoUrl: string | null;
  configs: TeamConfig[];
}
