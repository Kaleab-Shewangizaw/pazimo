"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useAuthStore } from "@/store/authStore";

import { BasicInfoSection } from "./_components/basic-info-section";
import { CreateEventPageShell } from "./_components/create-event-page-shell";
import { CreateEventSidebar } from "./_components/create-event-sidebar";
import { EventImagesSection } from "./_components/event-images-section";
import { TicketTypesSection } from "./_components/ticket-types-section";
import { WaveTicketDialog } from "./_components/wave-ticket-dialog";
import type {
  Category,
  EventFormData,
  TicketType,
  WaveDraft,
} from "./_lib/event-form-types";
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
} from "./_lib/event-form-utils";

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

    const firstWave = orderedGroup[0];
    if (!firstWave) {
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

export default function CreateEventPage() {
  const router = useRouter();
  const { token, user } = useAuthStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [waveDialogOpen, setWaveDialogOpen] = useState(false);
  const [selectedRegularTicketIndex, setSelectedRegularTicketIndex] = useState<
    number | null
  >(null);
  const [waveDrafts, setWaveDrafts] = useState<WaveDraft[]>([]);
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
          prev.ticketTypes.filter((ticket) => getWaveGroupId(ticket) !== waveGroup),
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

  const createWaveTickets = () => {
    if (selectedRegularTicketIndex === null) {
      toast.error("No ticket selected for wave creation");
      return;
    }

    if (waveDrafts.length < 2) {
      toast.error("Please add at least two waves");
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

    const parentWave = buildWaveTicket(waveDrafts[0], 1);
    const childWaves = waveDrafts
      .slice(1)
      .map((draft, index) => buildWaveTicket(draft, index + 2));

    const nextTicketTypes = formData.ticketTypes.filter((ticket, index) => {
      if (index === selectedRegularTicketIndex) {
        return false;
      }

      return getWaveGroupId(ticket) !== waveGroup;
    });

    const insertionIndex = Math.min(selectedRegularTicketIndex, nextTicketTypes.length);
    nextTicketTypes.splice(insertionIndex, 0, parentWave, ...childWaves);

    setFormData((prev) => ({
      ...prev,
      ticketTypes: recalculateTicketAvailability(nextTicketTypes),
    }));

    setWaveDrafts([]);
    setSelectedRegularTicketIndex(null);
    setWaveDialogOpen(false);
    toast.success("Wave tickets updated");
  };

  const validateWaveForm = () => {
    if (waveDrafts.length < 2) {
      return "Please add at least two waves";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!formData.category) {
        toast.error("Please select a category");
        return;
      }

      if (
        !formData.startDate ||
        !formData.endDate ||
        !formData.startTime ||
        !formData.endTime
      ) {
        toast.error("Please fill in all event date and time fields");
        return;
      }

      if (
        formData.ageRestriction.hasRestriction &&
        formData.ageRestriction.minAge &&
        formData.ageRestriction.maxAge &&
        Number(formData.ageRestriction.minAge) >
          Number(formData.ageRestriction.maxAge)
      ) {
        toast.error("Minimum age cannot be greater than maximum age");
        return;
      }

      const priceValidationError = getTicketPriceValidationError(
        formData.ticketTypes,
      );
      if (priceValidationError) {
        toast.error(priceValidationError);
        return;
      }

      const hasInvalidTickets = formData.ticketTypes.some(
        (ticket) => !hasAtLeastOneTicketPrice(ticket),
      );

      if (hasInvalidTickets) {
        toast.error("Each ticket must have at least one currency price");
        return;
      }

      if (!validateTicketDates()) {
        return;
      }

      const userId = user?._id || user?.id;
      if (!userId || !token) {
        throw new Error("Authentication expired. Please sign in again.");
      }

      const payload = new FormData();
      payload.append("organizer", userId);
      payload.append("title", formData.title);
      payload.append("description", formData.description);
      payload.append("category", formData.category);
      payload.append("isPublic", String(formData.isPublic));
      payload.append("startDate", formData.startDate);

      if (formData.endDate) {
        payload.append("endDate", formData.endDate);
      }

      if (formData.startTime) {
        payload.append("startTime", formData.startTime);
      }

      if (formData.endTime) {
        payload.append("endTime", formData.endTime);
      }

      payload.append("capacity", formData.capacity);
      payload.append("tags", formData.tags);

      payload.append("location[address]", formData.location.address);
      payload.append("location[city]", formData.location.city);
      payload.append("location[country]", formData.location.country);

      if (formData.location.coordinates.length === 2) {
        payload.append(
          "location[coordinates][0]",
          String(formData.location.coordinates[0]),
        );
        payload.append(
          "location[coordinates][1]",
          String(formData.location.coordinates[1]),
        );
      }

      if (formData.ageRestriction.hasRestriction) {
        payload.append("ageRestriction[hasRestriction]", "true");

        if (formData.ageRestriction.minAge) {
          payload.append(
            "ageRestriction[minAge]",
            formData.ageRestriction.minAge,
          );
        }

        if (formData.ageRestriction.maxAge) {
          payload.append(
            "ageRestriction[maxAge]",
            formData.ageRestriction.maxAge,
          );
        }
      }

      formData.ticketTypes.forEach((ticket, index) => {
        payload.append(`ticketTypes[${index}][name]`, ticket.name);

        if (ticket.priceETB) {
          payload.append(`ticketTypes[${index}][priceETB]`, ticket.priceETB);
        }

        if (ticket.priceUSD) {
          payload.append(`ticketTypes[${index}][priceUSD]`, ticket.priceUSD);
        }

        payload.append(
          `ticketTypes[${index}][price]`,
          ticket.priceETB || ticket.priceUSD || ticket.price || "0",
        );

        payload.append(`ticketTypes[${index}][quantity]`, ticket.quantity);
        payload.append(
          `ticketTypes[${index}][description]`,
          ticket.description,
        );
        payload.append(
          `ticketTypes[${index}][available]`,
          String(ticket.isActive),
        );

        if (ticket.waveOrder) {
          payload.append(
            `ticketTypes[${index}][waveOrder]`,
            String(ticket.waveOrder),
          );
          payload.append(
            `ticketTypes[${index}][waveSwitchMode]`,
            String(ticket.waveSwitchMode || "date"),
          );
          payload.append(
            `ticketTypes[${index}][waveGroup]`,
            String(ticket.waveGroup || "regular_wave"),
          );
        }

        if (
          (ticket.name === "Regular" && ticket.hasDateRange) &&
          ticket.saleStartDate &&
          ticket.saleEndDate
        ) {
          payload.append(
            `ticketTypes[${index}][startDate]`,
            ticket.saleStartDate,
          );
          payload.append(`ticketTypes[${index}][endDate]`, ticket.saleEndDate);
          payload.append(
            `ticketTypes[${index}][hasDateRange]`,
            String(ticket.hasDateRange),
          );
        }

        if (isWaveTicket(ticket) && ticket.saleStartDate) {
          payload.append(
            `ticketTypes[${index}][startDate]`,
            ticket.saleStartDate,
          );
        }
      });

      formData.coverImages.forEach((coverImage) => {
        payload.append("coverImages", coverImage);
      });

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: payload,
      });

      if (!response.ok) {
        let errorMessage = "Failed to create event";

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

      toast.success("Event created successfully");
      router.push("/organizer/events");
    } catch (error) {
      console.error("Error creating event:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create event",
      );
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
  return (
    <>
      <form id="create-event-form" onSubmit={handleSubmit}>
        <CreateEventPageShell
          sidebar={
            <CreateEventSidebar
              isSubmitting={isSubmitting}
              isSubmitDisabled={Boolean(waveValidationError)}
              onCancel={() => router.back()}
            />
          }
        >
          <div className="flex w-full flex-col gap-6">
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

            <EventImagesSection
              coverImages={formData.coverImages}
              onImageChange={handleImageChange}
              onRemoveImage={removeImage}
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
