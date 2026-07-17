export type TicketType = {
  _id: string;
  name: string;
  price: number;
  priceETB?: number;
  priceUSD?: number;
  quantity: number;
  description?: string;
  available: boolean;
  startDate?: string;
  endDate?: string;
  wave?: string;
};

export type Currency = "ETB" | "USD";

export function formatTicketPrice(
  ticket: TicketType,
  currency: Currency,
): string {
  if (currency === "USD") {
    const price = ticket.priceUSD || 0;
    return price === 0 ? "Free" : `$${price}`;
  }
  const price = ticket.priceETB || ticket.price || 0;
  return price === 0 ? "Free" : `${price} Birr`;
}
