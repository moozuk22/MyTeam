export interface ClubRow {
  id: string;
  name: string;
  emblemUrl?: string | null;
  imageUrl?: string | null;
  imagePublicId?: string | null;
  notifyOnCoachVisit?: boolean;
  billingStatus?: string;
  createdAt?: string | null;
}
