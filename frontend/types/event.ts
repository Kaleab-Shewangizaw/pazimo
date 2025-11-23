export interface TicketType {
  name: string;
  price: number;
  quantity: number;
  description: string;
  available: boolean;
  startDate?: string;
  endDate?: string;
}

export interface Location {
  type: "Point";
  coordinates: [number, number];
  address: string;
  city: string;
  country: string;
}

export interface Event {
  _id: string;
  title: string;
  description: string;
  category: string;
  startDate: string;
  endDate: string;
  // location: Location
  location: string;
  organizer: string;
  coverImage: string;
  startTime: string;
  endTime: string;
  eventType: "public" | "private";
  isPublic: boolean;
  ageRestriction: string;
  eventImages: Array<{ url: string; caption: string }>;
  ticketTypes: TicketType[];
  status: "draft" | "published" | "cancelled" | "completed";
  capacity: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
