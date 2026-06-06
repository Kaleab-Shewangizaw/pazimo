import type {
  EventFormData,
  TicketType,
  VisibleTicketEntry,
  WaveDraft,
  WaveSwitchMode,
} from "./event-form-types";

export const TICKET_TYPES = ["Regular", "VIP", "VVIP", "Group"] as const;

export const WAVE_SWITCH_MODES: { value: WaveSwitchMode; label: string }[] = [
  { value: "date", label: "Starts On Specific Date" },
  { value: "quantity", label: "When Previous Wave Sells Out" },
  { value: "date_or_quantity", label: "Date or Sell Out (whichever comes first)" },
];

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const parseDateValue = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
};

export const formatDateValue = (date?: Date | null) => {
  if (!date) {
    return "";
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export const createEmptyTicketType = (): TicketType => ({
  name: "Regular",
  price: "",
  priceETB: "",
  priceUSD: "",
  quantity: "",
  description: "",
  saleStartDate: "",
  saleEndDate: "",
  isActive: true,
  hasDateRange: false,
});

export const createInitialEventFormData = (): EventFormData => ({
  title: "",
  description: "",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  location: {
    address: "",
    city: "",
    country: "",
    coordinates: [],
  },
  category: "",
  isPublic: true,
  ageRestriction: {
    minAge: "",
    maxAge: "",
    hasRestriction: false,
  },
  ticketTypes: [createEmptyTicketType()],
  capacity: "",
  tags: "",
  coverImages: [],
});

export const syncLegacyPriceField = (ticket: TicketType): TicketType => ({
  ...ticket,
  price: ticket.priceETB || ticket.priceUSD || ticket.price || "",
});

export const isWaveTicket = (ticket: TicketType) =>
  Boolean(ticket.waveOrder || ticket.waveGroup || /wave/i.test(ticket.name || ""));

export const isWaveChildTicket = (ticket: TicketType) =>
  Boolean(ticket.waveGroup) && Number(ticket.waveOrder || 0) > 1;

export const getWaveGroupId = (ticket: TicketType) =>
  String(ticket.waveGroup || "").trim();

export const getWaveChildren = (
  ticket: TicketType,
  ticketTypes: TicketType[] = [],
) => {
  const waveGroup = getWaveGroupId(ticket);
  if (!waveGroup) {
    return [];
  }

  return ticketTypes
    .filter(
      (candidate) =>
        getWaveGroupId(candidate) === waveGroup &&
        Number(candidate.waveOrder || 0) > 1,
    )
    .sort(
      (a, b) => Number(a.waveOrder || 0) - Number(b.waveOrder || 0),
    );
};

export const getVisibleTicketEntries = (
  ticketTypes: TicketType[],
): VisibleTicketEntry[] =>
  ticketTypes
    .map((ticket, index) => ({ ticket, index }))
    .filter(({ ticket }) => !isWaveChildTicket(ticket));

export const getWaveParentTickets = (ticketTypes: TicketType[]) =>
  ticketTypes
    .filter((ticket) => Number(ticket.waveOrder || 0) === 1)
    .sort((a, b) => Number(a.waveOrder || 0) - Number(b.waveOrder || 0));

export const groupWaveTickets = (ticketTypes: TicketType[]) =>
  ticketTypes.reduce<Record<string, TicketType[]>>((groups, ticket) => {
    const waveGroup = getWaveGroupId(ticket);
    if (!waveGroup) {
      return groups;
    }

    if (!groups[waveGroup]) {
      groups[waveGroup] = [];
    }

    groups[waveGroup].push(ticket);
    return groups;
  }, {});

export const getComparableTicketPrice = (
  ticket: Pick<TicketType, "priceETB" | "priceUSD" | "price">,
) => ticket.priceETB || ticket.priceUSD || ticket.price || "";

export const hasAtLeastOneTicketPrice = (
  ticket: Pick<TicketType, "priceETB" | "priceUSD">,
) => Boolean(ticket.priceETB || ticket.priceUSD);

export const buildWaveDraftFromTicket = (
  ticket: TicketType,
  fallbackName: string,
): WaveDraft => ({
  id: createId(),
  name: ticket.name || fallbackName,
  priceETB: ticket.priceETB || "",
  priceUSD: ticket.priceUSD || "",
  quantity: ticket.quantity || "0",
  description: ticket.description || "",
  waveSwitchMode: ticket.waveSwitchMode || "date",
  saleStartDate: ticket.saleStartDate || "",
  saleEndDate: ticket.saleEndDate || "",
});

export const createDefaultWaveDraft = (seed: Partial<WaveDraft> = {}): WaveDraft => ({
  id: createId(),
  name: "Wave",
  priceETB: "",
  priceUSD: "",
  quantity: "",
  description: "",
  waveSwitchMode: "date",
  saleStartDate: "",
  saleEndDate: "",
  ...seed,
});

export const formatTicketPrice = (
  ticket: Pick<TicketType, "priceETB" | "priceUSD">,
) => {
  const labels: string[] = [];

  if (ticket.priceETB) {
    labels.push(`${ticket.priceETB} ETB`);
  }

  if (ticket.priceUSD) {
    labels.push(`$${ticket.priceUSD}`);
  }

  return labels.join(" / ") || "Not set";
};

export const formatDateWindow = (startDate: string, endDate: string) => {
  if (!startDate && !endDate) {
    return "No sales window";
  }

  const formatDate = (value: string) =>
    value ? new Date(value).toLocaleDateString() : "Not set";

  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
};

export const formatWaveActivationSummary = (
  ticket: Pick<TicketType, "waveOrder" | "waveSwitchMode" | "saleStartDate">,
) => {
  const waveOrder = Number(ticket.waveOrder || 0);

  if (waveOrder <= 1) {
    return "Default active wave";
  }

  if (ticket.waveSwitchMode === "quantity") {
    return "Starts when previous wave sells out";
  }

  if (ticket.waveSwitchMode === "date_or_quantity") {
    if (ticket.saleStartDate) {
      return `Starts ${new Date(ticket.saleStartDate).toLocaleDateString()} or when previous wave sells out`;
    }
    return "Starts on date or when previous wave sells out";
  }

  if (ticket.saleStartDate) {
    return `Starts ${new Date(ticket.saleStartDate).toLocaleDateString()}`;
  }

  return "Start date not set";
};
