export interface Category {
  _id: string;
  name: string;
  description: string;
  isPublished: boolean;
}

export type WaveSwitchMode = "date" | "quantity" | "date_or_quantity";

export interface WaveDraft {
  id: string;
  name: string;
  priceETB: string;
  priceUSD: string;
  quantity: string;
  description: string;
  waveSwitchMode: WaveSwitchMode;
  saleStartDate: string;
  /** Wall-clock Africa/Addis_Ababa time of day, "HH:MM". */
  saleStartTime: string;
  saleEndDate: string;
}

export interface EventLocation {
  address: string;
  city: string;
  country: string;
  coordinates: number[];
}

export interface AgeRestriction {
  minAge: string;
  maxAge: string;
  hasRestriction: boolean;
}

export interface TicketType {
  /** Present once the ticket type has been saved to the backend at least once. */
  _id?: string;
  name: string;
  price: string;
  priceETB: string;
  priceUSD: string;
  quantity: string;
  description: string;
  saleStartDate: string;
  /** Wall-clock Africa/Addis_Ababa time of day, "HH:MM". */
  saleStartTime?: string;
  saleEndDate: string;
  isActive: boolean;
  hasDateRange: boolean;
  waveOrder?: number;
  waveSwitchMode?: WaveSwitchMode;
  waveGroup?: string;
  /**
   * The wave chain owned by this ticket type. When present, this ticket
   * type's own name/price/quantity mutate in place as the chain advances —
   * waves are never separate ticket types. `waves[0]` is always the
   * currently-mirrored state's origin; the server is the source of truth for
   * which wave is actually live.
   */
  waves?: WaveDraft[];
}

export interface EventFormData {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: EventLocation;
  category: string;
  isPublic: boolean;
  ageRestriction: AgeRestriction;
  ticketTypes: TicketType[];
  capacity: string;
  tags: string;
  coverImages: File[];
}

export interface VisibleTicketEntry {
  ticket: TicketType;
  index: number;
}
