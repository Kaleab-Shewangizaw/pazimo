export interface Category {
  _id: string;
  name: string;
  description: string;
  isPublished: boolean;
}

export type WaveSwitchMode = "date" | "quantity";

export interface WaveDraft {
  id: string;
  name: string;
  priceETB: string;
  priceUSD: string;
  quantity: string;
  description: string;
  waveSwitchMode: WaveSwitchMode;
  saleStartDate: string;
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
  name: string;
  price: string;
  priceETB: string;
  priceUSD: string;
  quantity: string;
  description: string;
  saleStartDate: string;
  saleEndDate: string;
  isActive: boolean;
  hasDateRange: boolean;
  waveOrder?: number;
  waveSwitchMode?: WaveSwitchMode;
  waveGroup?: string;
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
