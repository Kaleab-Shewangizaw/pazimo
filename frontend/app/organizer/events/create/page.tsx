"use client";
import type React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  Info,
  AlertCircle,
  DollarSign,
  Waves,
  Plus,
  Trash2,
  MapPin,
  Loader2,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Image from "next/image";

interface Category {
  _id: string;
  name: string;
  description: string;
  isPublished: boolean;
}

// Predefined ticket types
const TICKET_TYPES = ["Regular", "VIP", "VVIP", "Group"];

const WAVE_SWITCH_MODES = [
  { value: "date", label: "By Date / Time Window" },
  { value: "quantity", label: "When Previous Wave Is Sold Out" },
  { value: "date_or_quantity", label: "When Time Is Up Or Sold Out" },
];

type WaveDraft = {
  id: string;
  name: string;
  priceETB: string;
  quantity: string;
  description: string;
  waveSwitchMode: "date" | "quantity" | "date_or_quantity";
  saleStartDate: string;
  saleEndDate: string;
};

const isWaveTicket = (ticket: any) =>
  Boolean(ticket?.waveOrder || ticket?.waveGroup || /wave/i.test(ticket?.name || ""));

const createDefaultWaveDraft = (seed: Partial<WaveDraft> = {}): WaveDraft => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  name: "Wave",
  priceETB: "",
  quantity: "",
  description: "",
  waveSwitchMode: "date",
  saleStartDate: "",
  saleEndDate: "",
  ...seed,
});

export default function CreateEventPage() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [currentDate] = useState(new Date().toISOString().split("T")[0]); // Today's date in YYYY-MM-DD format
  const [waveValidationError, setWaveValidationError] = useState("");
  const [waveDialogOpen, setWaveDialogOpen] = useState(false);
  const [selectedRegularTicketIndex, setSelectedRegularTicketIndex] = useState<
    number | null
  >(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [waveDrafts, setWaveDrafts] = useState<WaveDraft[]>([]);
  const [formData, setFormData] = useState({
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
      coordinates: [] as number[],
    },
    category: "",
    isPublic: true,
    ageRestriction: {
      minAge: "",
      maxAge: "",
      hasRestriction: false,
    },
    ticketTypes: [
      {
        name: "Regular",
        price: "", // Kept for backward compatibility
        priceETB: "",
        priceUSD: "",
        quantity: "",
        description: "",
        saleStartDate: "",
        saleEndDate: "",
        isActive: true,
        hasDateRange: false,
      },
    ],
    capacity: "",
    tags: "",
    coverImages: [] as File[],
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  // Check if a ticket is currently active based on date
  const isTicketActive = (startDate: string, endDate: string): boolean => {
    if (!startDate || !endDate) return true; // If no dates set, consider it active
    const today = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Set to end of day
    return today >= start && today <= end;
  };

  // Check if a ticket's date has passed
  const isDatePassed = (endDate: string): boolean => {
    if (!endDate) return false;
    const today = new Date();
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Set to end of day
    return today > end;
  };

  // Update active status of all tickets
  const updateActiveTicketStatus = () => {
    const newTicketTypes = [...formData.ticketTypes] as any[];
    const today = new Date();

    // Update active status based on date ranges
    newTicketTypes.forEach((ticket) => {
      if (isWaveTicket(ticket) || (ticket.name === "Regular" && ticket.hasDateRange)) {
        const mode = (ticket.waveSwitchMode || "date_or_quantity").toLowerCase();
        if (ticket.saleStartDate && ticket.saleEndDate) {
          const startDate = new Date(ticket.saleStartDate);
          const endDate = new Date(ticket.saleEndDate);
          endDate.setHours(23, 59, 59, 999);

          // Ticket is active if current date is within the sale period
          ticket.isActive = today >= startDate && today <= endDate;
        } else if (isWaveTicket(ticket) && mode === "quantity") {
          ticket.isActive = Number(ticket.quantity || 0) > 0;
        }
      }
    });

    setFormData((prev) => ({
      ...prev,
      ticketTypes: newTicketTypes,
    }));
  };

  // Update active status whenever ticket dates change
  useEffect(() => {
    updateActiveTicketStatus();
  }, [
    formData.ticketTypes
      .map((t) => t.saleStartDate + t.saleEndDate + t.hasDateRange)
      .join(","),
  ]);

  // Validate wave prices whenever they change
  useEffect(() => {
    validateTicketPrices();
  }, [
    formData.ticketTypes
      .map((t) => t.name + t.price + t.hasDateRange)
      .join(","),
  ]);

  const fetchCategories = async () => {
    try {
      setIsLoadingCategories(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/categories`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch categories");
      }
      const data = await response.json();

      // Only show published categories
      const publishedCategories = data.data.filter(
        (cat: Category) => cat.isPublished
      );

      setCategories(publishedCategories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast.error("Failed to fetch categories");
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
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
    } else if (name.startsWith("ageRestriction.")) {
      const ageField = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        ageRestriction: {
          ...prev.ageRestriction,
          [ageField]: value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const updateWaveDraft = (
    waveId: string,
    field: keyof WaveDraft,
    value: string
  ) => {
    setWaveDrafts((prev) =>
      prev.map((wave) =>
        wave.id === waveId ? { ...wave, [field]: value } : wave
      )
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
    field: string,
    value: string | boolean
  ) => {
    const newTicketTypes = [...formData.ticketTypes];
    newTicketTypes[index] = {
      ...newTicketTypes[index],
      [field]: value,
    };
    setFormData((prev) => ({
      ...prev,
      ticketTypes: newTicketTypes,
    }));
  };

  const addTicketType = () => {
    setFormData((prev) => ({
      ...prev,
      ticketTypes: [
        ...prev.ticketTypes,
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
        },
      ],
    }));
  };

  const removeTicketType = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      ticketTypes: prev.ticketTypes.filter((_, i) => i !== index),
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFormData((prev) => ({
        ...prev,
        coverImages: [...prev.coverImages, ...newFiles],
      }));
    }
  };

  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      coverImages: prev.coverImages.filter((_, i) => i !== index),
    }));
  };

  const validateTicketDates = (): boolean => {
    const waveTickets = formData.ticketTypes
      .filter((ticket) => isWaveTicket(ticket))
      .sort((a: any, b: any) => Number(a.waveOrder || 0) - Number(b.waveOrder || 0));

    for (const wave of waveTickets) {
      const mode = (((wave as any).waveSwitchMode as string) || "date_or_quantity").toLowerCase();
      if (mode !== "quantity") {
        if (!wave.saleStartDate || !wave.saleEndDate) {
          toast.error(`Wave "${wave.name}" requires start and end dates`);
          return false;
        }

        const start = new Date(wave.saleStartDate);
        const end = new Date(wave.saleEndDate);
        if (start >= end) {
          toast.error(`Wave "${wave.name}" must have start date before end date`);
          return false;
        }
      }
    }

    for (let i = 0; i < waveTickets.length - 1; i++) {
      const current = waveTickets[i];
      const next = waveTickets[i + 1];

      if (
        current.saleEndDate &&
        next.saleStartDate &&
        new Date(current.saleEndDate) >= new Date(next.saleStartDate)
      ) {
        toast.error(
          `Wave "${current.name}" should end before "${next.name}" starts`
        );
        return false;
      }
    }

    // Validate regular tickets with date ranges
    const regularTicketsWithDates = formData.ticketTypes.filter(
      (t) =>
        t.name === "Regular" &&
        t.hasDateRange &&
        t.saleStartDate &&
        t.saleEndDate
    );
    for (const ticket of regularTicketsWithDates) {
      const startDate = new Date(ticket.saleStartDate);
      const endDate = new Date(ticket.saleEndDate);
      if (startDate >= endDate) {
        toast.error("Sale start date must be before sale end date");
        return false;
      }
    }

    // Check for overlapping regular ticket date ranges
    for (let i = 0; i < regularTicketsWithDates.length; i++) {
      for (let j = i + 1; j < regularTicketsWithDates.length; j++) {
        const ticket1Start = new Date(regularTicketsWithDates[i].saleStartDate);
        const ticket1End = new Date(regularTicketsWithDates[i].saleEndDate);
        const ticket2Start = new Date(regularTicketsWithDates[j].saleStartDate);
        const ticket2End = new Date(regularTicketsWithDates[j].saleEndDate);

        // Check for overlap
        if (
          (ticket1Start <= ticket2End && ticket1End >= ticket2Start) ||
          (ticket2Start <= ticket1End && ticket2End >= ticket1Start)
        ) {
          toast.error("Regular tickets cannot have overlapping sale dates");
          return false;
        }
      }
    }

    return true;
  };

  const validateTicketPrices = (): boolean => {
    setWaveValidationError("");

    const waveTickets = formData.ticketTypes.filter((ticket) => isWaveTicket(ticket));
    if (waveTickets.length > 1) {
      const wavePrices = waveTickets
        .map((ticket) => (ticket?.priceETB ? Number.parseFloat(ticket.priceETB) : null))
        .filter(Boolean) as number[];

      // Check if all prices are unique
      const uniquePrices = new Set(wavePrices);
      if (uniquePrices.size !== wavePrices.length) {
        setWaveValidationError("Each wave must have a different price");
        return false;
      }
    }

    // Validate regular tickets with date ranges
    const regularTicketsWithDates = formData.ticketTypes.filter(
      (t) => t.name === "Regular" && t.hasDateRange && t.price
    );
    if (regularTicketsWithDates.length > 1) {
      const regularPrices = regularTicketsWithDates.map((ticket) =>
        Number.parseFloat(ticket.price)
      );
      const uniqueRegularPrices = new Set(regularPrices);
      if (uniqueRegularPrices.size !== regularPrices.length) {
        setWaveValidationError(
          "Each date-ranged Regular ticket must have a different price"
        );
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate required fields
      if (!formData.category) {
        toast.error("Please select a category");
        setIsSubmitting(false);
        return;
      }

      if (
        !formData.startDate ||
        !formData.endDate ||
        !formData.startTime ||
        !formData.endTime
      ) {
        toast.error("Please fill in all event date and time fields");
        setIsSubmitting(false);
        return;
      }

      // Validate ticket prices
      if (!validateTicketPrices()) {
        toast.error(
          waveValidationError ||
            "Each ticket with a date range must have a different price"
        );
        setIsSubmitting(false);
        return;
      }

      // Validate that at least one currency price is set for each ticket
      const hasInvalidTickets = formData.ticketTypes.some(
        (ticket) => !ticket.priceETB && !ticket.priceUSD
      );
      if (hasInvalidTickets) {
        toast.error("Each ticket must have at least one currency price (ETB or USD)");
        setIsSubmitting(false);
        return;
      }

      // Validate ticket dates
      if (!validateTicketDates()) {
        setIsSubmitting(false);
        return;
      }

      // Get user ID from auth store
      const userId = user?._id || user?.id;
      if (!userId) {
        throw new Error("User ID not found. Please sign in again.");
      }

      const formDataToSend = new FormData();

      // Append organizer ID (CRITICAL FIX)
      formDataToSend.append("organizer", userId);

      // Append basic event data
      formDataToSend.append("title", formData.title);
      formDataToSend.append("description", formData.description);
      formDataToSend.append("category", formData.category);
      formDataToSend.append("isPublic", String(formData.isPublic));
      formDataToSend.append("startDate", formData.startDate);
      if (formData.endDate) {
        formDataToSend.append("endDate", formData.endDate);
      }
      if (formData.startTime) {
        formDataToSend.append("startTime", formData.startTime);
      }
      if (formData.endTime) {
        formDataToSend.append("endTime", formData.endTime);
      }
      formDataToSend.append("capacity", formData.capacity);
      formDataToSend.append("tags", formData.tags);

      // Append location data
      formDataToSend.append("location[address]", formData.location.address);
      formDataToSend.append("location[city]", formData.location.city);
      formDataToSend.append("location[country]", formData.location.country);
      if (
        formData.location.coordinates &&
        formData.location.coordinates.length === 2
      ) {
        formDataToSend.append(
          "location[coordinates][0]",
          String(formData.location.coordinates[0])
        );
        formDataToSend.append(
          "location[coordinates][1]",
          String(formData.location.coordinates[1])
        );
      }

      // Append age restriction data
      if (formData.ageRestriction.hasRestriction) {
        formDataToSend.append("ageRestriction[hasRestriction]", "true");
        if (formData.ageRestriction.minAge) {
          formDataToSend.append(
            "ageRestriction[minAge]",
            formData.ageRestriction.minAge
          );
        }
        if (formData.ageRestriction.maxAge) {
          formDataToSend.append(
            "ageRestriction[maxAge]",
            formData.ageRestriction.maxAge
          );
        }
      }

      // Append ticket types
      formData.ticketTypes.forEach((ticket, index) => {
        formDataToSend.append(`ticketTypes[${index}][name]`, ticket.name);
        
        // Send dual pricing fields
        if (ticket.priceETB) {
          formDataToSend.append(`ticketTypes[${index}][priceETB]`, ticket.priceETB);
        }
        if (ticket.priceUSD) {
          formDataToSend.append(`ticketTypes[${index}][priceUSD]`, ticket.priceUSD);
        }
        // Also send price field for backward compatibility (use ETB as default)
        formDataToSend.append(`ticketTypes[${index}][price]`, ticket.priceETB || ticket.priceUSD || "0");
        
        formDataToSend.append(
          `ticketTypes[${index}][quantity]`,
          ticket.quantity
        );
        formDataToSend.append(
          `ticketTypes[${index}][description]`,
          ticket.description
        );
        formDataToSend.append(
          `ticketTypes[${index}][available]`,
          String(ticket.isActive)
        );

        if ((ticket as any).waveOrder) {
          formDataToSend.append(
            `ticketTypes[${index}][waveOrder]`,
            String((ticket as any).waveOrder)
          );
          formDataToSend.append(
            `ticketTypes[${index}][waveSwitchMode]`,
            String((ticket as any).waveSwitchMode || "date_or_quantity")
          );
          formDataToSend.append(
            `ticketTypes[${index}][waveGroup]`,
            String((ticket as any).waveGroup || "regular_wave")
          );
        }

        // Add date ranges for wave tickets and regular tickets with date ranges
        if (
          ((isWaveTicket(ticket) ||
            (ticket.name === "Regular" && ticket.hasDateRange)) &&
            ticket.saleStartDate &&
            ticket.saleEndDate)
        ) {
          // Map to the field names expected by the backend schema
          formDataToSend.append(
            `ticketTypes[${index}][startDate]`,
            ticket.saleStartDate
          );
          formDataToSend.append(
            `ticketTypes[${index}][endDate]`,
            ticket.saleEndDate
          );
          // Keep this for frontend reference if needed
          formDataToSend.append(
            `ticketTypes[${index}][hasDateRange]`,
            String(ticket.hasDateRange)
          );
        }
      });

      // Append cover images if selected
      formData.coverImages.forEach((coverImage, index) => {
        formDataToSend.append("coverImages", coverImage);
      });

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formDataToSend,
        }
      );

      if (!response.ok) {
        let errorMessage = "Failed to create event";
        try {
          const error = await response.json();
          errorMessage = error.message || errorMessage;
        } catch (e) {
          console.error("Failed to parse error response:", e);
          if (response.status === 413) {
            errorMessage = "File too large. Please upload smaller images.";
          } else {
            errorMessage = `Server error (${response.status})`;
          }
        }
        throw new Error(errorMessage);
      }

      toast.success("Event created successfully");
      router.push("/organizer/events");
    } catch (error) {
      console.error("Error creating event:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create event"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getWaveTickets = () =>
    formData.ticketTypes
      .filter((ticket) => isWaveTicket(ticket))
      .sort((a: any, b: any) => Number(a.waveOrder || 0) - Number(b.waveOrder || 0));

  // Check if we have multiple tickets with date ranges
  const hasMultipleDateRangedTickets = () => {
    const waveCount = formData.ticketTypes.filter((t) => isWaveTicket(t)).length;
    const regularWithDatesCount = formData.ticketTypes.filter(
      (t) => t.name === "Regular" && t.hasDateRange
    ).length;
    return waveCount + regularWithDatesCount > 1;
  };

  // Open wave creation dialog for a specific regular ticket
  const openWaveCreationDialog = (index: number) => {
    setSelectedRegularTicketIndex(index);
    const ticket = formData.ticketTypes[index];
    const defaultPrice = ticket.priceETB || ticket.price || "";
    setWaveDrafts([
      createDefaultWaveDraft({
        name: `Wave 1`,
        priceETB: defaultPrice,
        quantity: ticket.quantity || "0",
        description: ticket.description || "",
      }),
    ]);
    setWaveDialogOpen(true);
  };

  // Create wave tickets based on the form data
  const createWaveTickets = () => {
    if (selectedRegularTicketIndex === null) {
      toast.error("No ticket selected for wave creation");
      return;
    }

    const baseTicket = formData.ticketTypes[selectedRegularTicketIndex];
    const waveGroup = `wave_group_${Date.now()}`;
    const waveTickets = waveDrafts.map((draft, index) => {
      const price = Number.parseFloat(draft.priceETB || "0");
      const usesDates = draft.waveSwitchMode !== "quantity";
      return {
        name: draft.name,
        price: price.toFixed(2),
        priceETB: price.toFixed(2),
        priceUSD: "",
        quantity: draft.quantity || baseTicket.quantity || "0",
        description: draft.description || baseTicket.description || "",
        saleStartDate: usesDates ? draft.saleStartDate : "",
        saleEndDate: usesDates ? draft.saleEndDate : "",
        isActive:
          index === 0
            ? usesDates
              ? isTicketActive(draft.saleStartDate, draft.saleEndDate)
              : true
            : false,
        hasDateRange: usesDates,
        waveOrder: index + 1,
        waveSwitchMode: draft.waveSwitchMode,
        waveGroup,
      };
    });

    // Add the wave tickets to the form data
    const newTicketTypes = [...formData.ticketTypes];
    newTicketTypes[selectedRegularTicketIndex] = waveTickets[0];
    newTicketTypes.push(...waveTickets.slice(1));

    setFormData((prev) => ({
      ...prev,
      ticketTypes: newTicketTypes,
    }));

    setWaveDrafts([]);

    setSelectedRegularTicketIndex(null);
    setWaveDialogOpen(false);
    toast.success("Wave tickets created successfully.");
  };

  // Validate wave creation form
  const validateWaveForm = (): boolean => {
    if (waveDrafts.length === 0) {
      toast.error("Please add at least one wave");
      return false;
    }

    for (let i = 0; i < waveDrafts.length; i++) {
      const wave = waveDrafts[i];

      if (!wave.name.trim()) {
        toast.error(`Please enter a name for wave ${i + 1}`);
        return false;
      }

      const price = Number.parseFloat(wave.priceETB || "0");
      if (isNaN(price) || price <= 0) {
        toast.error(`Please enter a valid price for wave "${wave.name}"`);
        return false;
      }

      const qty = Number.parseInt(wave.quantity || "0");
      if (isNaN(qty) || qty <= 0) {
        toast.error(`Please enter a valid quantity for wave "${wave.name}"`);
        return false;
      }

      if (wave.waveSwitchMode !== "quantity") {
        if (!wave.saleStartDate || !wave.saleEndDate) {
          toast.error(`Please set start and end dates for wave "${wave.name}"`);
          return false;
        }

        if (new Date(wave.saleStartDate) >= new Date(wave.saleEndDate)) {
          toast.error(`Wave "${wave.name}" start date must be before end date`);
          return false;
        }
      }

      if (i < waveDrafts.length - 1) {
        const nextWave = waveDrafts[i + 1];
        if (
          wave.saleEndDate &&
          nextWave.saleStartDate &&
          new Date(wave.saleEndDate) >= new Date(nextWave.saleStartDate)
        ) {
          toast.error(
            `Wave "${wave.name}" must end before "${nextWave.name || `Wave ${i + 2}`}" starts`
          );
          return false;
        }
      }
    }

    return true;
  };

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by this browser");
      return;
    }

    setIsGettingLocation(true);
    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000,
          });
        }
      );

      const { latitude, longitude } = position.coords;

      // Use reverse geocoding to get address details
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
      );
      if (!response.ok) {
        throw new Error("Failed to get location details");
      }
      const data = await response.json();
      // console.log("Geocoding response:", data) // Debug log

      const address = data.display_name || "";

      // More robust city extraction with specific handling for Ethiopian cities
      const addressData = data.address || {};
      let city = "";

      // Try multiple fields for city detection
      if (addressData.city) {
        city = addressData.city;
      } else if (addressData.town) {
        city = addressData.town;
      } else if (addressData.village) {
        city = addressData.village;
      } else if (addressData.municipality) {
        city = addressData.municipality;
      } else if (addressData.county) {
        city = addressData.county;
      } else if (addressData.state) {
        city = addressData.state;
      } else if (addressData.district) {
        city = addressData.district;
      } else if (addressData.suburb) {
        city = addressData.suburb;
      }

      // Special handling for Addis Ababa and other Ethiopian cities
      // Check if "Addis Ababa" appears anywhere in the address string
      if (address.toLowerCase().includes("addis ababa")) {
        city = "Addis Ababa";
      } else if (address.toLowerCase().includes("addis")) {
        // If only "addis" is found, check if it's likely Addis Ababa
        city = "Addis Ababa";
      }

      // Additional check for other major Ethiopian cities
      const ethiopianCities = [
        "bahir dar",
        "gondar",
        "mekelle",
        "hawassa",
        "dire dawa",
        "jimma",
        "dessie",
        "shashamane",
        "bishoftu",
        "arba minch",
      ];

      for (const ethiopianCity of ethiopianCities) {
        if (address.toLowerCase().includes(ethiopianCity)) {
          // Capitalize the first letter of each word
          city = ethiopianCity
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
          break;
        }
      }

      const country = addressData.country || "";
      // console.log("Extracted location data:", { address, city, country }) // Debug log

      setFormData((prev) => ({
        ...prev,
        location: {
          address: address,
          city: city,
          country: country,
          coordinates: [longitude, latitude],
        },
      }));
      toast.success("Location detected successfully!");
    } catch (error) {
      console.error("Error getting location:", error);
      if (error instanceof GeolocationPositionError) {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error(
              "Location access denied. Please enable location permissions."
            );
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error("Location information unavailable.");
            break;
          case error.TIMEOUT:
            toast.error("Location request timed out.");
            break;
          default:
            toast.error("An unknown error occurred while getting location.");
        }
      } else {
        toast.error("Failed to get location details. Please enter manually.");
      }
    } finally {
      setIsGettingLocation(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <Button
          variant="ghost"
          className="mb-4 text-sm sm:text-base"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Events
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
          Create New Event
        </h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">
          Create a new event for your organization
        </p>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 sm:gap-8">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:gap-6">
              <div className="grid gap-2">
                <Label htmlFor="title">Event Title</Label>
                <Input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Enter event title"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Enter event description"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    name="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => {
                      const newStartDate = e.target.value;
                      setFormData((prev) => {
                        let newEndDate = prev.endDate;
                        // If end date is before start date, adjust it
                        if (newEndDate && newEndDate < newStartDate) {
                          newEndDate = newStartDate;
                        }
                        return {
                          ...prev,
                          startDate: newStartDate,
                          endDate: newEndDate,
                        };
                      });
                    }}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    name="endDate"
                    type="date"
                    value={formData.endDate}
                    min={formData.startDate}
                    onChange={(e) => {
                      const newEndDate = e.target.value;
                      setFormData((prev) => {
                        // If end time goes past midnight and dates are same, adjust end date
                        let adjustedEndDate = newEndDate;
                        if (
                          prev.startDate === newEndDate &&
                          prev.endTime &&
                          prev.startTime &&
                          prev.endTime < prev.startTime
                        ) {
                          const nextDay = new Date(newEndDate);
                          nextDay.setDate(nextDay.getDate() + 1);
                          adjustedEndDate = nextDay.toISOString().split("T")[0];
                        }
                        return {
                          ...prev,
                          endDate: adjustedEndDate,
                        };
                      });
                    }}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    name="startTime"
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => {
                      const newStartTime = e.target.value;
                      setFormData((prev) => {
                        let newEndDate = prev.endDate;
                        // If same date and end time is before start time, move end date to next day
                        if (
                          prev.startDate === prev.endDate &&
                          prev.endTime &&
                          newStartTime > prev.endTime
                        ) {
                          const nextDay = new Date(prev.endDate);
                          nextDay.setDate(nextDay.getDate() + 1);
                          newEndDate = nextDay.toISOString().split("T")[0];
                        }
                        return {
                          ...prev,
                          startTime: newStartTime,
                          endDate: newEndDate,
                        };
                      });
                    }}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    name="endTime"
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => {
                      const newEndTime = e.target.value;
                      setFormData((prev) => {
                        let newEndDate = prev.endDate;
                        // If same date and end time is before start time, move end date to next day
                        if (
                          prev.startDate === prev.endDate &&
                          prev.startTime &&
                          newEndTime < prev.startTime
                        ) {
                          const nextDay = new Date(prev.endDate);
                          nextDay.setDate(nextDay.getDate() + 1);
                          newEndDate = nextDay.toISOString().split("T")[0];
                        }
                        return {
                          ...prev,
                          endTime: newEndTime,
                          endDate: newEndDate,
                        };
                      });
                    }}
                    required
                  />
                </div>
              </div>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="location.address">Venue</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      id="location.address"
                      name="location.address"
                      value={formData.location.address}
                      onChange={handleInputChange}
                      placeholder="Enter event Venue "
                      className="flex-1"
                    />
                    {/* <Button
                      type="button"
                      variant="outline"
                      onClick={getCurrentLocation}
                      disabled={isGettingLocation}
                      className="shrink-0 bg-transparent"
                    >
                      {isGettingLocation ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MapPin className="h-4 w-4" />
                      )}
                      {isGettingLocation ? "Getting..." : "Get Location"}
                    </Button> */}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="location.city">City</Label>
                    <Input
                      id="location.city"
                      name="location.city"
                      value={formData.location.city}
                      onChange={handleInputChange}
                      placeholder="Enter city"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="location.country">Country</Label>
                    <Input
                      id="location.country"
                      name="location.country"
                      value={formData.location.country}
                      onChange={handleInputChange}
                      placeholder="Enter country"
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, category: value }))
                  }
                  disabled={isLoadingCategories}
                  required
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        isLoadingCategories
                          ? "Loading categories..."
                          : "Select category"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category._id} value={category._id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="eventType">Event Type</Label>
                <Select
                  value={formData.isPublic ? "public" : "private"}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      isPublic: value === "public",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select event type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="capacity">Event Capacity</Label>
                <Input
                  id="capacity"
                  name="capacity"
                  type="number"
                  min="0"
                  value={formData.capacity}
                  onChange={handleInputChange}
                  placeholder="Enter event capacity"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  name="tags"
                  value={formData.tags}
                  onChange={handleInputChange}
                  placeholder="Enter tags (e.g., music, sports, conference)"
                />
              </div>

              {/* Age Restriction */}
              <div className="grid gap-4 p-4 border rounded-lg bg-gray-50">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="age-restriction-toggle"
                    checked={formData.ageRestriction.hasRestriction}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        ageRestriction: {
                          ...prev.ageRestriction,
                          hasRestriction: checked,
                        },
                      }))
                    }
                  />
                  <Label
                    htmlFor="age-restriction-toggle"
                    className="cursor-pointer text-sm sm:text-base"
                  >
                    <div className="flex items-center gap-1">
                      <Info className="h-4 w-4 text-gray-500" />
                      <span>Enable age restriction</span>
                    </div>
                  </Label>
                </div>
                {formData.ageRestriction.hasRestriction && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="ageRestriction.minAge">Minimum Age</Label>
                      <Input
                        id="ageRestriction.minAge"
                        name="ageRestriction.minAge"
                        type="number"
                        min="0"
                        max="120"
                        value={formData.ageRestriction.minAge}
                        onChange={handleInputChange}
                        placeholder="Enter minimum age"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="ageRestriction.maxAge">Maximum Age</Label>
                      <Input
                        id="ageRestriction.maxAge"
                        name="ageRestriction.maxAge"
                        type="number"
                        min="0"
                        max="120"
                        value={formData.ageRestriction.maxAge}
                        onChange={handleInputChange}
                        placeholder="Enter maximum age"
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          {/* Ticket Information */}
          {hasMultipleDateRangedTickets() && (
            <Alert className="bg-blue-50 border-blue-200 p-3 sm:p-4">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <p className="font-medium text-sm sm:text-base">
                  Time-Limited Ticket System
                </p>
                <p className="text-xs sm:text-sm mt-1">
                  Today is {currentDate}. Tickets will automatically become
                  available based on their sale dates. Each time-limited ticket
                  must have a different price.
                </p>
                {waveValidationError && (
                  <p className="text-xs sm:text-sm mt-1 text-red-600 font-medium">
                    {waveValidationError}
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}
          {/* Price Comparison */}
          {hasMultipleDateRangedTickets() && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="h-4 w-4 text-gray-600" />
                <h3 className="font-medium text-sm sm:text-base text-gray-800">
                  Price Comparison
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {getWaveTickets().map((ticket, idx) => (
                  <div
                    key={`wave-${idx}`}
                    className="p-3 bg-blue-50 rounded-md border border-blue-100"
                  >
                    <p className="text-xs sm:text-sm font-medium text-blue-800">
                      {ticket.name || `Wave ${idx + 1}`}
                    </p>
                    <p className="text-base sm:text-lg font-bold mt-1">
                      {ticket.priceETB && `${ticket.priceETB} Birr`}
                      {ticket.priceETB && ticket.priceUSD && " / "}
                      {ticket.priceUSD && `$${ticket.priceUSD}`}
                      {!ticket.priceETB && !ticket.priceUSD && "Not set"}
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      Trigger: {(ticket as any).waveSwitchMode || "date_or_quantity"}
                    </p>
                    {ticket.saleStartDate && ticket.saleEndDate && (
                      <p className="text-xs text-blue-700 mt-1">
                        {new Date(ticket.saleStartDate).toLocaleDateString()} -{" "}
                        {new Date(ticket.saleEndDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
                {formData.ticketTypes
                  .filter((t) => t.name === "Regular" && t.hasDateRange)
                  .map((ticket, idx) => (
                  <div
                    key={`regular-date-${idx}`}
                    className="p-3 bg-green-50 rounded-md border border-green-100"
                  >
                    <p className="text-xs sm:text-sm font-medium text-green-800">
                      Regular (Time-Limited {idx + 1})
                    </p>
                    <p className="text-base sm:text-lg font-bold mt-1">
                      {ticket.priceETB && `${ticket.priceETB} Birr`}
                      {ticket.priceETB && ticket.priceUSD && " / "}
                      {ticket.priceUSD && `$${ticket.priceUSD}`}
                      {!ticket.priceETB && !ticket.priceUSD && "Not set"}
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      {ticket.saleStartDate
                        ? new Date(ticket.saleStartDate).toLocaleDateString()
                        : "Start date not set"}{" "}
                      -
                      {ticket.saleEndDate
                        ? new Date(ticket.saleEndDate).toLocaleDateString()
                        : "End date not set"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Ticket Types */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg sm:text-xl">Ticket Types</CardTitle>
              <Button
                type="button"
                variant="outline"
                onClick={addTicketType}
                className="text-sm sm:text-base bg-transparent"
              >
                Add Ticket Type
              </Button>
            </CardHeader>
            <CardContent className="grid gap-6">
              {formData.ticketTypes.map((ticketType, index) => (
                <div key={index} className="grid gap-4 p-4 border rounded-lg">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-base sm:text-lg">
                        Ticket Type {index + 1}
                      </h3>
                      {(isWaveTicket(ticketType) ||
                        (ticketType.name === "Regular" && ticketType.hasDateRange)) && (
                        <Badge
                          className={
                            ticketType.isActive
                              ? "bg-green-500 text-xs sm:text-sm"
                              : "bg-gray-400 text-xs sm:text-sm"
                          }
                        >
                          {ticketType.isActive ? "Active" : "Inactive"}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {ticketType.name === "Regular" && !isWaveTicket(ticketType) && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-blue-600 border-blue-200 hover:bg-blue-50 text-xs sm:text-sm h-8 bg-transparent"
                            onClick={() => openWaveCreationDialog(index)}
                          >
                            <Waves className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            Create Waves
                          </Button>
                        )}
                      {index > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 text-xs sm:text-sm h-8"
                          onClick={() => removeTicketType(index)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor={`ticket-name-${index}`}>Name</Label>
                      {isWaveTicket(ticketType) ? (
                        <Input
                          id={`ticket-name-${index}`}
                          value={ticketType.name}
                          onChange={(e) =>
                            handleTicketTypeChange(index, "name", e.target.value)
                          }
                          placeholder="Enter wave name"
                        />
                      ) : (
                        <Select
                          value={ticketType.name}
                          onValueChange={(value) => {
                            handleTicketTypeChange(index, "name", value);
                          }}
                        >
                          <SelectTrigger id={`ticket-name-${index}`}>
                            <SelectValue placeholder="Select ticket type" />
                          </SelectTrigger>
                          <SelectContent>
                            {TICKET_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor={`ticket-price-etb-${index}`}>
                          Price (ETB - Birr)
                        </Label>
                        <Input
                          id={`ticket-price-etb-${index}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={ticketType.priceETB}
                          onChange={(e) =>
                            handleTicketTypeChange(
                              index,
                              "priceETB",
                              e.target.value
                            )
                          }
                          placeholder="Enter price in Birr"
                        />
                        <p className="text-xs text-muted-foreground">
                          Leave empty if not available in Birr
                        </p>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`ticket-price-usd-${index}`}>
                          Price (USD - Dollar)
                        </Label>
                        <Input
                          id={`ticket-price-usd-${index}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={ticketType.priceUSD}
                          onChange={(e) =>
                            handleTicketTypeChange(
                              index,
                              "priceUSD",
                              e.target.value
                            )
                          }
                          placeholder="Enter price in USD"
                        />
                        <p className="text-xs text-muted-foreground">
                          Leave empty if not available in USD
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor={`ticket-quantity-${index}`}>
                          Quantity Available
                        </Label>
                        <Input
                          id={`ticket-quantity-${index}`}
                          type="number"
                          min="0"
                          value={ticketType.quantity}
                          onChange={(e) =>
                            handleTicketTypeChange(
                              index,
                              "quantity",
                              e.target.value
                            )
                          }
                          placeholder="Enter quantity"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`ticket-description-${index}`}>
                        Description
                      </Label>
                      <Textarea
                        id={`ticket-description-${index}`}
                        value={ticketType.description}
                        onChange={(e) =>
                          handleTicketTypeChange(
                            index,
                            "description",
                            e.target.value
                          )
                        }
                        placeholder="Enter ticket type description (optional)"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          {/* Event Images */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Event Images</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="coverImages">Cover Images</Label>
                  <Input
                    id="coverImages"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    multiple
                    required={formData.coverImages.length === 0}
                  />
                  <p className="text-sm text-gray-500">
                    Upload one or more cover images for your event (recommended
                    size: 1200x600 pixels)
                  </p>
                </div>
                {formData.coverImages.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {formData.coverImages.map((image, index) => (
                      <div key={index} className="relative group">
                        <div className="aspect-video relative rounded-lg overflow-hidden border">
                          <Image
                            src={
                              URL.createObjectURL(image) || "/placeholder.svg"
                            }
                            alt={`Cover image ${index + 1}`}
                            fill
                            className="object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {image.name}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={isSubmitting || !!waveValidationError}
            >
              {isSubmitting ? "Creating Event..." : "Create Event"}
            </Button>
          </div>
        </div>
      </form>
      {/* Wave Creation Dialog */}
      <Dialog open={waveDialogOpen} onOpenChange={setWaveDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md sm:max-w-[600px] mx-auto p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Waves className="h-5 w-5" />
              Create Wave Tickets
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              Add as many waves as you need. Each wave can have a custom name,
              price, quantity, and activation type.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Configure waves in order. You can add unlimited waves.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addWaveDraft}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Wave
              </Button>
            </div>

            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                Ticket Wave List
              </p>
              <div className="flex flex-wrap gap-2">
                {waveDrafts.map((wave, idx) => (
                  <span
                    key={`wave-preview-${wave.id}`}
                    className="inline-flex items-center rounded-full border bg-background px-2.5 py-1 text-xs"
                  >
                    {idx + 1}. {wave.name?.trim() || `Wave ${idx + 1}`}
                  </span>
                ))}
              </div>
            </div>

            {waveDrafts.map((wave, idx) => (
              <div key={wave.id} className="border rounded-md p-3 grid gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Wave {idx + 1}</h4>
                  {waveDrafts.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => removeWaveDraft(wave.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Wave Name</Label>
                    <Input
                      value={wave.name}
                      onChange={(e) =>
                        updateWaveDraft(wave.id, "name", e.target.value)
                      }
                      placeholder="e.g. Early Bird, VIP Access, Gate Wave"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Activation Type</Label>
                    <Select
                      value={wave.waveSwitchMode}
                      onValueChange={(value) =>
                        updateWaveDraft(wave.id, "waveSwitchMode", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent>
                        {WAVE_SWITCH_MODES.map((mode) => (
                          <SelectItem key={mode.value} value={mode.value}>
                            {mode.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Price (ETB)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={wave.priceETB}
                      onChange={(e) =>
                        updateWaveDraft(wave.id, "priceETB", e.target.value)
                      }
                      placeholder="Enter wave price"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={wave.quantity}
                      onChange={(e) =>
                        updateWaveDraft(wave.id, "quantity", e.target.value)
                      }
                      placeholder="Enter wave quantity"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Description (optional)</Label>
                  <Input
                    value={wave.description}
                    onChange={(e) =>
                      updateWaveDraft(wave.id, "description", e.target.value)
                    }
                    placeholder="Optional wave description"
                  />
                </div>

                {wave.waveSwitchMode !== "quantity" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={wave.saleStartDate}
                        onChange={(e) =>
                          updateWaveDraft(wave.id, "saleStartDate", e.target.value)
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>End Date</Label>
                      <Input
                        type="date"
                        value={wave.saleEndDate}
                        onChange={(e) =>
                          updateWaveDraft(wave.id, "saleEndDate", e.target.value)
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setWaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (validateWaveForm()) {
                  createWaveTickets();
                }
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Create Wave Tickets
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
