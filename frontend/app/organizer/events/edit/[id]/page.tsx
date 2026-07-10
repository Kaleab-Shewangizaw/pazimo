"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/authStore";

import { BasicInfoSection } from "../../create/_components/basic-info-section";
import { CreateEventPageShell } from "../../create/_components/create-event-page-shell";
import { EventImagesSection } from "../../create/_components/event-images-section";
import { TicketTypesSection } from "../../create/_components/ticket-types-section";
import { WaveTicketDialog } from "../../create/_components/wave-ticket-dialog";
import type {
  Category,
  EventFormData,
  TicketType,
  WaveDraft,
} from "../../create/_lib/event-form-types";
import {
  buildWaveDraftFromTicket,
  createDefaultWaveDraft,
  createEmptyTicketType,
  createInitialEventFormData,
  getComparableTicketPrice,
  getVisibleTicketEntries,
  getWaveChildren,
  getWaveGroupId,
  getWaveParentTickets,
  groupWaveTickets,
  hasAtLeastOneTicketPrice,
  isWaveTicket,
  syncLegacyPriceField,
} from "../../create/_lib/event-form-utils";

const isTicketActiveByDate = (startDate: string, endDate: string): boolean => {
  if (!startDate || !endDate) {
    return true;
  }

  const today = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  end.setHours(23, 59, 59, 999);
  return today >= start && today <= end;
};

const recalculateTicketAvailability = (ticketTypes: TicketType[]) => {
  const nextTicketTypes = ticketTypes.map((ticket) => ({ ...ticket }));

  nextTicketTypes.forEach((ticket) => {
    if (!isWaveTicket(ticket)) {
      if (ticket.name === "Regular" && ticket.hasDateRange) {
        ticket.isActive =
          ticket.saleStartDate && ticket.saleEndDate
            ? isTicketActiveByDate(ticket.saleStartDate, ticket.saleEndDate)
            : true;
      } else {
        ticket.isActive = true;
      }
    }
  });

  const waveGroups = groupWaveTickets(nextTicketTypes);

  Object.values(waveGroups).forEach((group) => {
    const orderedGroup = [...group].sort(
      (a, b) => Number(a.waveOrder || 0) - Number(b.waveOrder || 0),
    );

    orderedGroup.forEach((ticket) => {
      ticket.isActive = false;
    });

    if (orderedGroup.length === 0) {
      return;
    }

    let activeIndex = 0;

    for (let index = 1; index < orderedGroup.length; index += 1) {
      const wave = orderedGroup[index];
      const previousWave = orderedGroup[index - 1];
      const startsByDate =
        (wave.waveSwitchMode === "date" || wave.waveSwitchMode === "date_or_quantity") &&
        wave.saleStartDate &&
        new Date(wave.saleStartDate) <= new Date();
      const startsByQuantity =
        (wave.waveSwitchMode === "quantity" || wave.waveSwitchMode === "date_or_quantity") &&
        Number(previousWave?.quantity || 0) <= 0;

      if (startsByDate || startsByQuantity) {
        activeIndex = index;
      }
    }

    orderedGroup[activeIndex].isActive =
      Number(orderedGroup[activeIndex].quantity || 0) > 0;
  });

  return nextTicketTypes.map(syncLegacyPriceField);
};

const getTicketPriceValidationError = (ticketTypes: TicketType[]) => {
  const waveGroups = groupWaveTickets(ticketTypes);

  for (const group of Object.values(waveGroups)) {
    const priceSignatures = group
      .map((ticket) => [ticket.priceETB || "_", ticket.priceUSD || "_"].join(":"))
      .filter((value) => value !== "_:_");

    if (new Set(priceSignatures).size !== priceSignatures.length) {
      return "Each wave in the same chain must have a different price";
    }
  }

  const regularTicketsWithDates = ticketTypes.filter(
    (ticket) =>
      ticket.name === "Regular" &&
      ticket.hasDateRange &&
      getComparableTicketPrice(ticket),
  );

  const regularPrices = regularTicketsWithDates.map((ticket) =>
    [ticket.priceETB || "_", ticket.priceUSD || "_"].join(":"),
  );

  if (new Set(regularPrices).size !== regularPrices.length) {
    return "Each timed Regular ticket must have a different price";
  }

  return "";
};

const buildImageUrl = (imagePath?: string | null) => {
  if (!imagePath) {
    return null;
  }

  if (imagePath.startsWith("http")) {
    return imagePath;
  }

  const normalizedPath = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
  return `${process.env.NEXT_PUBLIC_API_URL}${normalizedPath}`;
};

const parseEventCoverImages = (event: any) => {
  if (Array.isArray(event?.coverImages) && event.coverImages.length > 0) {
    return event.coverImages;
  }

  if (event?.coverImage) {
    return [event.coverImage];
  }

  return [];
};

function EditEventSidebar({
  isSubmitting,
  isSubmitDisabled,
  onCancel,
}: {
  isSubmitting: boolean;
  isSubmitDisabled: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          <Button
            type="submit"
            disabled={isSubmitting || isSubmitDisabled}
            className="h-12 rounded-2xl bg-sky-600 text-base font-semibold text-white hover:bg-sky-700"
          >
            {isSubmitting ? "Updating Event..." : "Update Event"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="h-11 rounded-2xl border-slate-200 dark:border-slate-800"
          >
            Cancel
          </Button>
          <div className="flex items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="mr-2 h-4 w-4" />
            Changes save to this event
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;
  const { token } = useAuthStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [waveDialogOpen, setWaveDialogOpen] = useState(false);
  const [selectedRegularTicketIndex, setSelectedRegularTicketIndex] = useState<
    number | null
  >(null);
  const [waveDrafts, setWaveDrafts] = useState<WaveDraft[]>([]);
  const [existingCoverImages, setExistingCoverImages] = useState<string[]>([]);
  const [formData, setFormData] = useState<EventFormData>(
    createInitialEventFormData(),
  );

  const currentDate = new Date().toISOString().split("T")[0];

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoadingCategories(true);

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/categories`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch categories");
        }

        const data = await response.json();
        const publishedCategories = data.data.filter(
          (category: Category) => category.isPublished,
        );

        setCategories(publishedCategories);
      } catch (error) {
        console.error("Error fetching categories:", error);
        toast.error("Failed to fetch categories");
      } finally {
        setIsLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchEventData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/events/details/${eventId}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch event");
        }

        const data = await response.json();
        const event = data.data;

        setFormData({
          title: event.title || "",
          description: event.description || "",
          startDate: event.startDate
            ? new Date(event.startDate).toISOString().split("T")[0]
            : "",
          endDate: event.endDate
            ? new Date(event.endDate).toISOString().split("T")[0]
            : "",
          startTime: event.startTime || "",
          endTime: event.endTime || "",
          location: {
            address: event.location?.address || "",
            city: event.location?.city || "",
            country: event.location?.country || "",
            coordinates: event.location?.coordinates || ([] as number[]),
          },
          category: event.category?._id || "",
          isPublic:
            event.isPublic !== undefined ? Boolean(event.isPublic) : true,
          ageRestriction: {
            minAge: event.ageRestriction?.minAge?.toString() || "",
            maxAge: event.ageRestriction?.maxAge?.toString() || "",
            hasRestriction: event.ageRestriction?.hasRestriction || false,
          },
          ticketTypes:
            event.ticketTypes?.length > 0
              ? event.ticketTypes.map((ticket: any) => ({
                  name: ticket.name || "Regular",
                  price: ticket.price?.toString() || "",
                  priceETB: ticket.priceETB?.toString() || "",
                  priceUSD: ticket.priceUSD?.toString() || "",
                  quantity: ticket.quantity?.toString() || "",
                  description: ticket.description || "",
                  saleStartDate: ticket.startDate
                    ? new Date(ticket.startDate).toISOString().split("T")[0]
                    : "",
                  saleEndDate: ticket.endDate
                    ? new Date(ticket.endDate).toISOString().split("T")[0]
                    : "",
                  isActive:
                    ticket.available !== undefined ? ticket.available : true,
                  hasDateRange: !!(ticket.startDate && ticket.endDate),
                  waveSwitchMode: ticket.waveSwitchMode || "date",
                  waveOrder: ticket.waveOrder,
                  waveGroup: ticket.waveGroup || "",
                }))
              : [
                  {
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
                    waveSwitchMode: "date",
                    waveOrder: undefined,
                    waveGroup: "",
                  },
                ],
          capacity: event.capacity?.toString() || "",
          tags: event.tags?.join(", ") || "",
          coverImages: [],
        });

        setExistingCoverImages(parseEventCoverImages(event));
      } catch (error) {
        console.error("Error fetching event:", error);
        toast.error("Failed to load event data");
        router.push("/organizer/events");
      } finally {
        setIsLoading(false);
      }
    };

    fetchEventData();
  }, [eventId, router]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;

    if (name.startsWith("location.")) {
      const locationField = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        location: {
          ...prev.location,
          [locationField]: value,
        },
      }));
      return;
    }

    if (name.startsWith("ageRestriction.")) {
      const ageField = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        ageRestriction: {
          ...prev.ageRestriction,
          [ageField]: value,
        },
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleStartDateChange = (value: string) => {
    setFormData((prev) => {
      let nextEndDate = prev.endDate;

      if (nextEndDate && nextEndDate < value) {
        nextEndDate = value;
      }

      return {
        ...prev,
        startDate: value,
        endDate: nextEndDate,
      };
    });
  };

  const handleEndDateChange = (value: string) => {
    setFormData((prev) => {
      let nextEndDate = value;

      if (
        prev.startDate === value &&
        prev.endTime &&
        prev.startTime &&
        prev.endTime < prev.startTime
      ) {
        const nextDay = new Date(value);
        nextDay.setDate(nextDay.getDate() + 1);
        nextEndDate = nextDay.toISOString().split("T")[0];
      }

      return {
        ...prev,
        endDate: nextEndDate,
      };
    });
  };

  const handleStartTimeChange = (value: string) => {
    setFormData((prev) => {
      let nextEndDate = prev.endDate;

      if (
        prev.startDate === prev.endDate &&
        prev.endTime &&
        value > prev.endTime &&
        prev.endDate
      ) {
        const nextDay = new Date(prev.endDate);
        nextDay.setDate(nextDay.getDate() + 1);
        nextEndDate = nextDay.toISOString().split("T")[0];
      }

      return {
        ...prev,
        startTime: value,
        endDate: nextEndDate,
      };
    });
  };

  const handleEndTimeChange = (value: string) => {
    setFormData((prev) => {
      let nextEndDate = prev.endDate;

      if (
        prev.startDate === prev.endDate &&
        prev.startTime &&
        value < prev.startTime &&
        prev.endDate
      ) {
        const nextDay = new Date(prev.endDate);
        nextDay.setDate(nextDay.getDate() + 1);
        nextEndDate = nextDay.toISOString().split("T")[0];
      }

      return {
        ...prev,
        endTime: value,
        endDate: nextEndDate,
      };
    });
  };

  const handleTicketTypeChange = (
    index: number,
    field: keyof TicketType,
    value: string | boolean,
  ) => {
    setFormData((prev) => {
      const nextTicketTypes = [...prev.ticketTypes];
      const nextTicket = {
        ...nextTicketTypes[index],
        [field]: value,
      } as TicketType;

      nextTicketTypes[index] = syncLegacyPriceField(nextTicket);

      return {
        ...prev,
        ticketTypes: recalculateTicketAvailability(nextTicketTypes),
      };
    });
  };

  const addTicketType = () => {
    setFormData((prev) => ({
      ...prev,
      ticketTypes: recalculateTicketAvailability([
        ...prev.ticketTypes,
        createEmptyTicketType(),
      ]),
    }));
  };

  const removeTicketType = (index: number) => {
    setFormData((prev) => {
      const targetTicket = prev.ticketTypes[index];
      const waveGroup = getWaveGroupId(targetTicket);

      if (!waveGroup) {
        return {
          ...prev,
          ticketTypes: recalculateTicketAvailability(
            prev.ticketTypes.filter((_, ticketIndex) => ticketIndex !== index),
          ),
        };
      }

      return {
        ...prev,
        ticketTypes: recalculateTicketAvailability(
          prev.ticketTypes.filter(
            (ticket) => getWaveGroupId(ticket) !== waveGroup,
          ),
        ),
      };
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      return;
    }

    const newFiles = Array.from(e.target.files);

    setFormData((prev) => ({
      ...prev,
      coverImages: [...prev.coverImages, ...newFiles],
    }));
  };

  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      coverImages: prev.coverImages.filter((_, imageIndex) => imageIndex !== index),
    }));
  };

  const validateTicketDates = () => {
    const waveGroups = groupWaveTickets(formData.ticketTypes);

    for (const group of Object.values(waveGroups)) {
      const orderedGroup = [...group].sort(
        (a, b) => Number(a.waveOrder || 0) - Number(b.waveOrder || 0),
      );

      for (let index = 0; index < orderedGroup.length; index += 1) {
        const wave = orderedGroup[index];

        if (index === 0) {
          continue;
        }

        if (wave.waveSwitchMode !== "quantity") {
          if (!wave.saleStartDate) {
            toast.error(`Wave "${wave.name}" requires a start date`);
            return false;
          }
        }
      }

      for (let index = 0; index < orderedGroup.length - 1; index += 1) {
        const currentWave = orderedGroup[index];
        const nextWave = orderedGroup[index + 1];

        if (
          nextWave.saleStartDate &&
          currentWave.saleStartDate &&
          currentWave.waveOrder &&
          currentWave.waveOrder > 1 &&
          new Date(currentWave.saleStartDate) >= new Date(nextWave.saleStartDate)
        ) {
          toast.error(
            `Wave "${currentWave.name}" should start before "${nextWave.name}" starts`,
          );
          return false;
        }
      }
    }

    const regularTicketsWithDates = formData.ticketTypes.filter(
      (ticket) =>
        ticket.name === "Regular" &&
        ticket.hasDateRange &&
        ticket.saleStartDate &&
        ticket.saleEndDate,
    );

    for (const ticket of regularTicketsWithDates) {
      const startDate = new Date(ticket.saleStartDate);
      const endDate = new Date(ticket.saleEndDate);

      if (startDate >= endDate) {
        toast.error("Sale start date must be before sale end date");
        return false;
      }
    }

    for (let index = 0; index < regularTicketsWithDates.length; index += 1) {
      for (
        let compareIndex = index + 1;
        compareIndex < regularTicketsWithDates.length;
        compareIndex += 1
      ) {
        const ticketOneStart = new Date(regularTicketsWithDates[index].saleStartDate);
        const ticketOneEnd = new Date(regularTicketsWithDates[index].saleEndDate);
        const ticketTwoStart = new Date(
          regularTicketsWithDates[compareIndex].saleStartDate,
        );
        const ticketTwoEnd = new Date(
          regularTicketsWithDates[compareIndex].saleEndDate,
        );

        if (
          (ticketOneStart <= ticketTwoEnd && ticketOneEnd >= ticketTwoStart) ||
          (ticketTwoStart <= ticketOneEnd && ticketTwoEnd >= ticketOneStart)
        ) {
          toast.error("Regular tickets cannot have overlapping sale dates");
          return false;
        }
      }
    }

    return true;
  };

  const updateWaveDraft = (
    waveId: string,
    field: keyof WaveDraft,
    value: string,
  ) => {
    setWaveDrafts((prev) =>
      prev.map((wave) => (wave.id === waveId ? { ...wave, [field]: value } : wave)),
    );
  };

  const addWaveDraft = () => {
    setWaveDrafts((prev) => {
      const nextIndex = prev.length + 1;
      const previousWave = prev[prev.length - 1];

      return [
        ...prev,
        createDefaultWaveDraft({
          name: `Wave ${nextIndex}`,
          quantity: previousWave?.quantity || prev[0]?.quantity || "0",
          waveSwitchMode: previousWave?.waveSwitchMode || "date",
        }),
      ];
    });
  };

  const removeWaveDraft = (waveId: string) => {
    setWaveDrafts((prev) => prev.filter((wave) => wave.id !== waveId));
  };

  const openWaveCreationDialog = (index: number) => {
    setSelectedRegularTicketIndex(index);

    const ticket = formData.ticketTypes[index];
    const existingWaveChildren = getWaveChildren(ticket, formData.ticketTypes);
    const parentDraft = buildWaveDraftFromTicket(ticket, "Wave 1");

    if (existingWaveChildren.length > 0 || ticket.waveGroup) {
      setWaveDrafts([
        parentDraft,
        ...existingWaveChildren.map((wave, waveIndex) =>
          buildWaveDraftFromTicket(wave, `Wave ${waveIndex + 2}`),
        ),
      ]);
    } else {
      setWaveDrafts([
        parentDraft,
        createDefaultWaveDraft({
          name: "Wave 2",
          quantity: ticket.quantity || "0",
          waveSwitchMode: parentDraft.waveSwitchMode,
        }),
      ]);
    }

    setWaveDialogOpen(true);
  };

  const validateWaveForm = () => {
    if (waveDrafts.length < 1) {
      return "Please add at least one wave";
    }

    const priceSignatures: string[] = [];

    for (let index = 0; index < waveDrafts.length; index += 1) {
      const wave = waveDrafts[index];

      if (!wave.name.trim()) {
        return `Please enter a name for wave ${index + 1}`;
      }

      if (!wave.priceETB && !wave.priceUSD) {
        return `Please enter at least one price for wave "${wave.name}"`;
      }

      if (wave.priceETB) {
        const etbValue = Number.parseFloat(wave.priceETB);
        if (Number.isNaN(etbValue) || etbValue <= 0) {
          return `Please enter a valid ETB price for wave "${wave.name}"`;
        }
      }

      if (wave.priceUSD) {
        const usdValue = Number.parseFloat(wave.priceUSD);
        if (Number.isNaN(usdValue) || usdValue <= 0) {
          return `Please enter a valid USD price for wave "${wave.name}"`;
        }
      }

      const quantityValue = Number.parseInt(wave.quantity || "0", 10);
      if (Number.isNaN(quantityValue) || quantityValue <= 0) {
        return `Please enter a valid quantity for wave "${wave.name}"`;
      }

      if (index > 0 && wave.waveSwitchMode !== "quantity") {
        if (!wave.saleStartDate) {
          return `Please set a start date for wave "${wave.name}"`;
        }
      }

      if (index < waveDrafts.length - 1) {
        const nextWave = waveDrafts[index + 1];
        if (
          nextWave.saleStartDate &&
          index > 0 &&
          wave.saleStartDate &&
          new Date(wave.saleStartDate) >= new Date(nextWave.saleStartDate)
        ) {
          return `Wave "${wave.name}" must start before "${nextWave.name || `Wave ${index + 2}`}" starts`;
        }
      }

      priceSignatures.push([wave.priceETB || "_", wave.priceUSD || "_"].join(":"));
    }

    if (new Set(priceSignatures).size !== priceSignatures.length) {
      return "Each wave in the same chain must have a different price";
    }

    return null;
  };

  const createWaveTickets = () => {
    if (selectedRegularTicketIndex === null) {
      toast.error("No ticket selected for wave creation");
      return;
    }

    if (waveDrafts.length < 1) {
      toast.error("Please add at least one wave");
      return;
    }

    const baseTicket = formData.ticketTypes[selectedRegularTicketIndex];
    const waveGroup = getWaveGroupId(baseTicket) || `wave_group_${Date.now()}`;

    const buildWaveTicket = (draft: WaveDraft, waveOrder: number): TicketType => {
      const usesDates = waveOrder > 1 && draft.waveSwitchMode !== "quantity";

      return syncLegacyPriceField({
        name: draft.name,
        price: "",
        priceETB: draft.priceETB,
        priceUSD: draft.priceUSD,
        quantity: draft.quantity || baseTicket.quantity || "0",
        description: draft.description || baseTicket.description || "",
        saleStartDate: usesDates ? draft.saleStartDate : "",
        saleEndDate: "",
        isActive: false,
        hasDateRange: usesDates,
        waveOrder,
        waveSwitchMode: draft.waveSwitchMode,
        waveGroup,
      });
    };

    // Collapsing back down to a single wave means this is no longer a wave
    // chain — revert it to a plain ticket type with no wave metadata.
    const buildPlainTicket = (draft: WaveDraft): TicketType =>
      syncLegacyPriceField({
        name: draft.name,
        price: "",
        priceETB: draft.priceETB,
        priceUSD: draft.priceUSD,
        quantity: draft.quantity || baseTicket.quantity || "0",
        description: draft.description || baseTicket.description || "",
        saleStartDate: "",
        saleEndDate: "",
        isActive: true,
        hasDateRange: false,
      });

    const nextWaveTickets =
      waveDrafts.length === 1
        ? [buildPlainTicket(waveDrafts[0])]
        : [
            buildWaveTicket(waveDrafts[0], 1),
            ...waveDrafts.slice(1).map((draft, index) => buildWaveTicket(draft, index + 2)),
          ];

    const nextTicketTypes = formData.ticketTypes.filter((ticket, index) => {
      if (index === selectedRegularTicketIndex) {
        return false;
      }

      return getWaveGroupId(ticket) !== waveGroup;
    });

    const insertionIndex = Math.min(selectedRegularTicketIndex, nextTicketTypes.length);
    nextTicketTypes.splice(insertionIndex, 0, ...nextWaveTickets);

    setFormData((prev) => ({
      ...prev,
      ticketTypes: recalculateTicketAvailability(nextTicketTypes),
    }));

    setWaveDrafts([]);
    setSelectedRegularTicketIndex(null);
    setWaveDialogOpen(false);
    toast.success(
      waveDrafts.length === 1 ? "Wave removed" : "Wave tickets updated",
    );
  };

  const validateForm = () => {
    if (!formData.category) {
      toast.error("Please select a category");
      return false;
    }

    if (
      !formData.startDate ||
      !formData.endDate ||
      !formData.startTime ||
      !formData.endTime
    ) {
      toast.error("Please fill in all event date and time fields");
      return false;
    }

    if (
      formData.ageRestriction.hasRestriction &&
      formData.ageRestriction.minAge &&
      formData.ageRestriction.maxAge &&
      Number(formData.ageRestriction.minAge) > Number(formData.ageRestriction.maxAge)
    ) {
      toast.error("Minimum age cannot be greater than maximum age");
      return false;
    }

    const priceValidationError = getTicketPriceValidationError(formData.ticketTypes);
    if (priceValidationError) {
      toast.error(priceValidationError);
      return false;
    }

    const hasInvalidTickets = formData.ticketTypes.some(
      (ticket) => !hasAtLeastOneTicketPrice(ticket),
    );

    if (hasInvalidTickets) {
      toast.error("Each ticket must have at least one currency price");
      return false;
    }

    if (!validateTicketDates()) {
      return false;
    }

    if (existingCoverImages.length === 0 && formData.coverImages.length === 0) {
      toast.error("Please upload at least one cover image");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!validateForm()) {
        return;
      }

      if (!token) {
        throw new Error("Authentication expired. Please sign in again.");
      }

      const payload = new FormData();
      payload.append("title", formData.title);
      payload.append("description", formData.description);
      payload.append("category", formData.category);
      payload.append("isPublic", String(formData.isPublic));
      payload.append("startDate", formData.startDate);
      payload.append("endDate", formData.endDate);
      payload.append("startTime", formData.startTime);
      payload.append("endTime", formData.endTime);
      payload.append("capacity", formData.capacity);
      payload.append("tags", formData.tags);
      payload.append("location", JSON.stringify(formData.location));

      if (formData.ageRestriction.hasRestriction) {
        payload.append(
          "ageRestriction",
          JSON.stringify({
            hasRestriction: true,
            minAge: formData.ageRestriction.minAge
              ? Number.parseInt(formData.ageRestriction.minAge, 10)
              : undefined,
            maxAge: formData.ageRestriction.maxAge
              ? Number.parseInt(formData.ageRestriction.maxAge, 10)
              : undefined,
          }),
        );
      } else {
        payload.append("ageRestriction", JSON.stringify({ hasRestriction: false }));
      }

      payload.append(
        "ticketTypes",
        JSON.stringify(
          formData.ticketTypes.map((ticket) => ({
            name: ticket.name,
            price: Number.parseFloat(ticket.priceETB || ticket.priceUSD || "0"),
            priceETB: ticket.priceETB ? Number.parseFloat(ticket.priceETB) : undefined,
            priceUSD: ticket.priceUSD ? Number.parseFloat(ticket.priceUSD) : undefined,
            quantity: Number.parseInt(ticket.quantity, 10),
            description: ticket.description,
            available: ticket.isActive,
            ...(ticket.waveOrder
              ? {
                  waveOrder: Number(ticket.waveOrder),
                  waveGroup: ticket.waveGroup || "regular_wave",
                  waveSwitchMode: ticket.waveSwitchMode || "date",
                }
              : {}),
            ...(ticket.waveOrder && ticket.saleStartDate
              ? { startDate: ticket.saleStartDate }
              : {}),
            ...(!ticket.waveOrder &&
            ticket.hasDateRange &&
            ticket.saleStartDate &&
            ticket.saleEndDate
              ? {
                  startDate: ticket.saleStartDate,
                  endDate: ticket.saleEndDate,
                }
              : {}),
          })),
        ),
      );

      formData.coverImages.forEach((coverImage) => {
        payload.append("coverImages", coverImage);
      });

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/${eventId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: payload,
        },
      );

      if (!response.ok) {
        let errorMessage = "Failed to update event";

        try {
          const error = await response.json();
          errorMessage = error.message || errorMessage;
        } catch (parseError) {
          console.error("Failed to parse error response:", parseError);
          errorMessage =
            response.status === 413
              ? "File too large. Please upload smaller images."
              : `Server error (${response.status})`;
        }

        throw new Error(errorMessage);
      }

      toast.success("Event updated successfully");
      router.push("/organizer/events");
    } catch (error) {
      console.error("Error updating event:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update event");
    } finally {
      setIsSubmitting(false);
    }
  };

  const visibleTickets = getVisibleTicketEntries(formData.ticketTypes);
  const waveValidationError = getTicketPriceValidationError(formData.ticketTypes);
  const waveTickets = getWaveParentTickets(formData.ticketTypes);
  const regularDateTickets = formData.ticketTypes.filter(
    (ticket) => ticket.name === "Regular" && ticket.hasDateRange,
  );
  const hasMultipleDateRangedTickets =
    waveTickets.length + regularDateTickets.length > 1;

  const existingCoverImageUrls = useMemo(
    () =>
      existingCoverImages
        .map((image) => buildImageUrl(image))
        .filter((image): image is string => Boolean(image)),
    [existingCoverImages],
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">Loading event data...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <form id="edit-event-form" onSubmit={handleSubmit}>
        <CreateEventPageShell
          sidebar={
            <EditEventSidebar
              isSubmitting={isSubmitting}
              isSubmitDisabled={Boolean(waveValidationError)}
              onCancel={() => router.back()}
            />
          }
        >
          <div className="flex w-full flex-col gap-6">
            <section className="rounded-[28px]  border-slate-200 dark:border-slate-800 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-gradient-to-br from-slate-950 via-slate-900 to-sky-900 p-6 text-white shadow-sm sm:p-8">
              <div className="flex items-center min-w-0">
                <Button
                type="button"
                variant="ghost"
                onClick={() => router.back()}
                className=" h-10 shrink-0 cursor-pointer rounded-full border border-white/10 bg-white/5 px-4 text-white hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft className=" h-4 w-4" />

              </Button>

              <h1 className="text-xl font-bold ml-5 truncate">
                Edit Event
              </h1>
              </div>

                <Badge className="rounded-full bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/10 self-start sm:self-auto">
                  Organizer event editor
                </Badge>

            </section>

            <BasicInfoSection
              formData={formData}
              categories={categories}
              isLoadingCategories={isLoadingCategories}
              currentDate={currentDate}
              onFieldChange={handleInputChange}
              onCategoryChange={(value) =>
                setFormData((prev) => ({ ...prev, category: value }))
              }
              onVisibilityChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  isPublic: value === "public",
                }))
              }
              onAgeRestrictionToggle={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  ageRestriction: {
                    ...prev.ageRestriction,
                    hasRestriction: checked,
                  },
                }))
              }
              onStartDateChange={handleStartDateChange}
              onEndDateChange={handleEndDateChange}
              onStartTimeChange={handleStartTimeChange}
              onEndTimeChange={handleEndTimeChange}
            />

            <TicketTypesSection
              currentDate={currentDate}
              waveValidationError={waveValidationError}
              hasMultipleDateRangedTickets={hasMultipleDateRangedTickets}
              waveTickets={waveTickets}
              regularDateTickets={regularDateTickets}
              visibleTickets={visibleTickets}
              allTicketTypes={formData.ticketTypes}
              onAddTicketType={addTicketType}
              onRemoveTicketType={removeTicketType}
              onTicketTypeChange={handleTicketTypeChange}
              onOpenWaveDialog={openWaveCreationDialog}
              getWaveChildren={getWaveChildren}
            />

            {existingCoverImageUrls.length > 0 ? (
              <section className="rounded-[24px] border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 sm:p-5">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                      Current cover images
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Uploading new images will replace the current set on this event.
                    </p>
                  </div>
                  <Badge className="w-fit rounded-full bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800">
                    {existingCoverImageUrls.length} image
                    {existingCoverImageUrls.length === 1 ? "" : "s"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                  {existingCoverImageUrls.map((image, index) => (
                    <div
                      key={`${image}-${index}`}
                      className="overflow-hidden rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
                    >
                      <div className="relative aspect-[16/10]">
                        <Image
                          src={image}
                          alt={`Current cover image ${index + 1}`}
                          fill
                          className="object-cover"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <EventImagesSection
              coverImages={formData.coverImages}
              onImageChange={handleImageChange}
              onRemoveImage={removeImage}
              required={existingCoverImages.length === 0 && formData.coverImages.length === 0}
            />
          </div>
        </CreateEventPageShell>
      </form>

      <WaveTicketDialog
        open={waveDialogOpen}
        waveDrafts={waveDrafts}
        onOpenChange={(open) => {
          setWaveDialogOpen(open);
          if (!open) {
            setSelectedRegularTicketIndex(null);
            setWaveDrafts([]);
          }
        }}
        onAddWaveDraft={addWaveDraft}
        onRemoveWaveDraft={removeWaveDraft}
        onUpdateWaveDraft={updateWaveDraft}
        onSubmit={() => {
          const errorMessage = validateWaveForm();

          if (errorMessage) {
            toast.error(errorMessage);
            return;
          }

          createWaveTickets();
        }}
      />
    </>
  );
}
