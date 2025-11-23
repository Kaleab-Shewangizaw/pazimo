"use client";
import type React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOrganizerAuthStore } from "@/store/organizerAuthStore";
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

// Wave-based ticket types that need date ranges
const WAVE_TICKET_TYPES = [
  "Regular - First Wave",
  "Regular - Second Wave",
  "Regular - Final Wave",
];

export default function CreateEventPage() {
  const router = useRouter();
  const { token } = useOrganizerAuthStore();
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
  const [waveFormData, setWaveFormData] = useState({
    basePrice: "",
    firstWaveStartDate: "",
    firstWaveEndDate: "",
    secondWaveStartDate: "",
    secondWaveEndDate: "",
    finalWaveStartDate: "",
    finalWaveEndDate: "",
    priceIncreasePercentage: "10",
  });
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
        price: "",
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
    const newTicketTypes = [...formData.ticketTypes];
    const today = new Date();

    // Update active status based on date ranges
    newTicketTypes.forEach((ticket) => {
      if (
        WAVE_TICKET_TYPES.includes(ticket.name) ||
        (ticket.name === "Regular" && ticket.hasDateRange)
      ) {
        if (ticket.saleStartDate && ticket.saleEndDate) {
          const startDate = new Date(ticket.saleStartDate);
          const endDate = new Date(ticket.saleEndDate);
          endDate.setHours(23, 59, 59, 999);

          // Ticket is active if current date is within the sale period
          ticket.isActive = today >= startDate && today <= endDate;
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

  const handleWaveFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setWaveFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
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
    // Validate wave ticket dates
    const firstWave = formData.ticketTypes.find(
      (t) => t.name === "Regular - First Wave"
    );
    const secondWave = formData.ticketTypes.find(
      (t) => t.name === "Regular - Second Wave"
    );
    const finalWave = formData.ticketTypes.find(
      (t) => t.name === "Regular - Final Wave"
    );

    if (firstWave && secondWave) {
      // Check if first wave ends before second wave starts
      const firstWaveEnd = new Date(firstWave.saleEndDate);
      const secondWaveStart = new Date(secondWave.saleStartDate);
      if (firstWaveEnd >= secondWaveStart) {
        toast.error("First wave must end before second wave begins");
        return false;
      }
    }

    if (secondWave && finalWave) {
      // Check if second wave ends before final wave starts
      const secondWaveEnd = new Date(secondWave.saleEndDate);
      const finalWaveStart = new Date(finalWave.saleStartDate);
      if (secondWaveEnd >= finalWaveStart) {
        toast.error("Second wave must end before final wave begins");
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
    // Validate wave ticket prices
    const firstWave = formData.ticketTypes.find(
      (t) => t.name === "Regular - First Wave"
    );
    const secondWave = formData.ticketTypes.find(
      (t) => t.name === "Regular - Second Wave"
    );
    const finalWave = formData.ticketTypes.find(
      (t) => t.name === "Regular - Final Wave"
    );

    const waveTickets = [firstWave, secondWave, finalWave].filter(Boolean);
    if (waveTickets.length > 1) {
      const wavePrices = waveTickets
        .map((ticket) =>
          ticket?.price ? Number.parseFloat(ticket.price) : null
        )
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

      // Validate ticket dates
      if (!validateTicketDates()) {
        setIsSubmitting(false);
        return;
      }

      // Get user ID from local storage
      const userId = localStorage.getItem("userId");
      if (!userId) {
        throw new Error("User ID not found. Please sign in again.");
      }

      const formDataToSend = new FormData();

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
      formDataToSend.append("organizer", userId); // Add the organizer ID

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
        formDataToSend.append(`ticketTypes[${index}][price]`, ticket.price);
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

        // Add date ranges for wave tickets and regular tickets with date ranges
        if (
          WAVE_TICKET_TYPES.includes(ticket.name) ||
          (ticket.name === "Regular" && ticket.hasDateRange)
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
        const error = await response.json();
        throw new Error(error.message || "Failed to create event");
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

  // Get wave tickets for price comparison
  const getWaveTickets = () => {
    const firstWave = formData.ticketTypes.find(
      (t) => t.name === "Regular - First Wave"
    );
    const secondWave = formData.ticketTypes.find(
      (t) => t.name === "Regular - Second Wave"
    );
    const finalWave = formData.ticketTypes.find(
      (t) => t.name === "Regular - Final Wave"
    );
    const regularTickets = formData.ticketTypes.filter(
      (t) => t.name === "Regular" && t.hasDateRange
    );
    return { firstWave, secondWave, finalWave, regularTickets };
  };

  // Check if we have multiple tickets with date ranges
  const hasMultipleDateRangedTickets = () => {
    const waveCount = formData.ticketTypes.filter((t) =>
      WAVE_TICKET_TYPES.includes(t.name)
    ).length;
    const regularWithDatesCount = formData.ticketTypes.filter(
      (t) => t.name === "Regular" && t.hasDateRange
    ).length;
    return waveCount + regularWithDatesCount > 1;
  };

  // Open wave creation dialog for a specific regular ticket
  const openWaveCreationDialog = (index: number) => {
    setSelectedRegularTicketIndex(index);
    // Initialize form with values from the selected ticket
    const ticket = formData.ticketTypes[index];
    setWaveFormData({
      basePrice: ticket.price || "",
      firstWaveStartDate: "",
      firstWaveEndDate: "",
      secondWaveStartDate: "",
      secondWaveEndDate: "",
      finalWaveStartDate: "",
      finalWaveEndDate: "",
      priceIncreasePercentage: "10",
    });
    setWaveDialogOpen(true);
  };

  // Create wave tickets based on the form data
  const createWaveTickets = () => {
    if (selectedRegularTicketIndex === null) {
      toast.error("No ticket selected for wave creation");
      return;
    }

    const baseTicket = formData.ticketTypes[selectedRegularTicketIndex];
    const basePrice = Number.parseFloat(waveFormData.basePrice);
    const priceIncrease =
      Number.parseFloat(waveFormData.priceIncreasePercentage) / 100;

    if (isNaN(basePrice) || basePrice <= 0) {
      toast.error("Please enter a valid base price");
      return;
    }

    if (isNaN(priceIncrease) || priceIncrease < 0) {
      toast.error("Please enter a valid price increase percentage");
      return;
    }

    // Calculate prices for each wave
    const secondWavePrice = (basePrice * (1 + priceIncrease)).toFixed(2);
    const finalWavePrice = (basePrice * (1 + priceIncrease * 2)).toFixed(2);

    // Create the three wave tickets
    const firstWaveTicket = {
      name: "Regular - First Wave",
      price: basePrice.toFixed(2),
      quantity: baseTicket.quantity || "0",
      description: baseTicket.description
        ? `${baseTicket.description} (First Wave)`
        : "First Wave Ticket",
      saleStartDate: waveFormData.firstWaveStartDate,
      saleEndDate: waveFormData.firstWaveEndDate,
      isActive: isTicketActive(
        waveFormData.firstWaveStartDate,
        waveFormData.firstWaveEndDate
      ),
      hasDateRange: true,
    };
    const secondWaveTicket = {
      name: "Regular - Second Wave",
      price: secondWavePrice,
      quantity: baseTicket.quantity || "0",
      description: baseTicket.description
        ? `${baseTicket.description} (Second Wave)`
        : "Second Wave Ticket",
      saleStartDate: waveFormData.secondWaveStartDate,
      saleEndDate: waveFormData.secondWaveEndDate,
      isActive: false, // Will be activated automatically when start date arrives
      hasDateRange: true,
    };
    const finalWaveTicket = {
      name: "Regular - Final Wave",
      price: finalWavePrice,
      quantity: baseTicket.quantity || "0",
      description: baseTicket.description
        ? `${baseTicket.description} (Final Wave)`
        : "Final Wave Ticket",
      saleStartDate: waveFormData.finalWaveStartDate,
      saleEndDate: waveFormData.finalWaveEndDate,
      isActive: false, // Will be activated automatically when start date arrives
      hasDateRange: true,
    };

    // Add the wave tickets to the form data
    const newTicketTypes = [...formData.ticketTypes];
    // Replace the original ticket with the first wave
    newTicketTypes[selectedRegularTicketIndex] = firstWaveTicket;
    // Add the second and final wave tickets
    newTicketTypes.push(secondWaveTicket, finalWaveTicket);

    setFormData((prev) => ({
      ...prev,
      ticketTypes: newTicketTypes,
    }));

    // Reset wave form data
    setWaveFormData({
      basePrice: "",
      firstWaveStartDate: "",
      firstWaveEndDate: "",
      secondWaveStartDate: "",
      secondWaveEndDate: "",
      finalWaveStartDate: "",
      finalWaveEndDate: "",
      priceIncreasePercentage: "10",
    });

    setSelectedRegularTicketIndex(null);
    setWaveDialogOpen(false);
    toast.success(
      "Wave tickets created successfully! Three wave tickets have been added with progressive pricing."
    );
  };

  // Validate wave creation form
  const validateWaveForm = (): boolean => {
    // Check if all required fields are filled
    if (
      !waveFormData.basePrice ||
      !waveFormData.firstWaveStartDate ||
      !waveFormData.firstWaveEndDate ||
      !waveFormData.secondWaveStartDate ||
      !waveFormData.secondWaveEndDate ||
      !waveFormData.finalWaveStartDate ||
      !waveFormData.finalWaveEndDate
    ) {
      toast.error(
        "Please fill in all required fields including base price and all dates"
      );
      return false;
    }

    // Validate base price
    const basePrice = Number.parseFloat(waveFormData.basePrice);
    if (isNaN(basePrice) || basePrice <= 0) {
      toast.error("Please enter a valid base price greater than 0");
      return false;
    }

    // Check if dates are sequential
    const firstWaveStart = new Date(waveFormData.firstWaveStartDate);
    const firstWaveEnd = new Date(waveFormData.firstWaveEndDate);
    const secondWaveStart = new Date(waveFormData.secondWaveStartDate);
    const secondWaveEnd = new Date(waveFormData.secondWaveEndDate);
    const finalWaveStart = new Date(waveFormData.finalWaveStartDate);
    const finalWaveEnd = new Date(waveFormData.finalWaveEndDate);

    // Validate individual wave date ranges
    if (firstWaveStart >= firstWaveEnd) {
      toast.error("First wave start date must be before end date");
      return false;
    }
    if (secondWaveStart >= secondWaveEnd) {
      toast.error("Second wave start date must be before end date");
      return false;
    }
    if (finalWaveStart >= finalWaveEnd) {
      toast.error("Final wave start date must be before end date");
      return false;
    }

    // Check sequential wave dates
    if (firstWaveEnd >= secondWaveStart) {
      toast.error("First wave must end before second wave begins");
      return false;
    }
    if (secondWaveEnd >= finalWaveStart) {
      toast.error("Second wave must end before final wave begins");
      return false;
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
                {getWaveTickets().firstWave && (
                  <div className="p-3 bg-blue-50 rounded-md border border-blue-100">
                    <p className="text-xs sm:text-sm font-medium text-blue-800">
                      First Wave
                    </p>
                    <p className="text-base sm:text-lg font-bold mt-1">
                      {getWaveTickets().firstWave?.price
                        ? `${getWaveTickets().firstWave?.price}`
                        : "Not set"}{" "}
                      birr
                    </p>
                  </div>
                )}
                {getWaveTickets().secondWave && (
                  <div className="p-3 bg-purple-50 rounded-md border border-purple-100">
                    <p className="text-xs sm:text-sm font-medium text-purple-800">
                      Second Wave
                    </p>
                    <p className="text-base sm:text-lg font-bold mt-1">
                      {getWaveTickets().secondWave?.price
                        ? `${getWaveTickets().secondWave?.price}`
                        : "Not set"}{" "}
                      birr
                    </p>
                  </div>
                )}
                {getWaveTickets().finalWave && (
                  <div className="p-3 bg-amber-50 rounded-md border border-amber-100">
                    <p className="text-xs sm:text-sm font-medium text-amber-800">
                      Final Wave
                    </p>
                    <p className="text-base sm:text-lg font-bold mt-1">
                      {getWaveTickets().finalWave?.price
                        ? `${getWaveTickets().finalWave?.price}`
                        : "Not set"}{" "}
                      birr
                    </p>
                  </div>
                )}
                {getWaveTickets().regularTickets.map((ticket, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-green-50 rounded-md border border-green-100"
                  >
                    <p className="text-xs sm:text-sm font-medium text-green-800">
                      Regular (Time-Limited {idx + 1})
                    </p>
                    <p className="text-base sm:text-lg font-bold mt-1">
                      {ticket.price ? `$${ticket.price}` : "Not set"}
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
                      {(WAVE_TICKET_TYPES.includes(ticketType.name) ||
                        (ticketType.name === "Regular" &&
                          ticketType.hasDateRange)) && (
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
                      {ticketType.name === "Regular" &&
                        !WAVE_TICKET_TYPES.some((wave) =>
                          formData.ticketTypes.some((t) => t.name === wave)
                        ) && (
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
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor={`ticket-price-${index}`}>Price</Label>
                        <Input
                          id={`ticket-price-${index}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={ticketType.price}
                          onChange={(e) =>
                            handleTicketTypeChange(
                              index,
                              "price",
                              e.target.value
                            )
                          }
                          placeholder="Enter price"
                          required
                          className={
                            waveValidationError &&
                            (WAVE_TICKET_TYPES.includes(ticketType.name) ||
                              (ticketType.name === "Regular" &&
                                ticketType.hasDateRange))
                              ? "border-red-300"
                              : ""
                          }
                        />
                      </div>
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
              Create First, Second, and Final wave tickets with automatic price
              increases.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="basePrice">Base Price (First Wave)</Label>
                <Input
                  id="basePrice"
                  name="basePrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={waveFormData.basePrice}
                  onChange={handleWaveFormChange}
                  placeholder="Enter base price"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="priceIncreasePercentage">
                  Price Increase (%)
                </Label>
                <Input
                  id="priceIncreasePercentage"
                  name="priceIncreasePercentage"
                  type="number"
                  min="1"
                  max="100"
                  value={waveFormData.priceIncreasePercentage}
                  onChange={handleWaveFormChange}
                  placeholder="Enter percentage"
                  required
                />
                <p className="text-xs text-gray-500">
                  Each wave will increase by this percentage from the base price
                </p>
              </div>
            </div>
            <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
              <h4 className="font-medium text-base sm:text-lg text-blue-800 mb-2">
                First Wave
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="firstWaveStartDate">Start Date</Label>
                  <Input
                    id="firstWaveStartDate"
                    name="firstWaveStartDate"
                    type="date"
                    value={waveFormData.firstWaveStartDate}
                    onChange={handleWaveFormChange}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="firstWaveEndDate">End Date</Label>
                  <Input
                    id="firstWaveEndDate"
                    name="firstWaveEndDate"
                    type="date"
                    value={waveFormData.firstWaveEndDate}
                    onChange={handleWaveFormChange}
                    required
                  />
                </div>
              </div>
            </div>
            <div className="bg-purple-50 p-3 rounded-md border border-purple-100">
              <h4 className="font-medium text-base sm:text-lg text-purple-800 mb-2">
                Second Wave
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="secondWaveStartDate">Start Date</Label>
                  <Input
                    id="secondWaveStartDate"
                    name="secondWaveStartDate"
                    type="date"
                    value={waveFormData.secondWaveStartDate}
                    onChange={handleWaveFormChange}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="secondWaveEndDate">End Date</Label>
                  <Input
                    id="secondWaveEndDate"
                    name="secondWaveEndDate"
                    type="date"
                    value={waveFormData.secondWaveEndDate}
                    onChange={handleWaveFormChange}
                    required
                  />
                </div>
              </div>
              <p className="text-xs text-purple-700 mt-2">
                Price:{" "}
                {waveFormData.basePrice
                  ? `${(
                      Number.parseFloat(waveFormData.basePrice) *
                      (1 +
                        Number.parseFloat(
                          waveFormData.priceIncreasePercentage
                        ) /
                          100)
                    ).toFixed(2)} birr`
                  : "Not set"}
              </p>
            </div>
            <div className="bg-amber-50 p-3 rounded-md border border-amber-100">
              <h4 className="font-medium text-base sm:text-lg text-amber-800 mb-2">
                Final Wave
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="finalWaveStartDate">Start Date</Label>
                  <Input
                    id="finalWaveStartDate"
                    name="finalWaveStartDate"
                    type="date"
                    value={waveFormData.finalWaveStartDate}
                    onChange={handleWaveFormChange}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="finalWaveEndDate">End Date</Label>
                  <Input
                    id="finalWaveEndDate"
                    name="finalWaveEndDate"
                    type="date"
                    value={waveFormData.finalWaveEndDate}
                    onChange={handleWaveFormChange}
                    required
                  />
                </div>
              </div>
              <p className="text-xs text-amber-700 mt-2">
                Price:{" "}
                {waveFormData.basePrice
                  ? `${(
                      Number.parseFloat(waveFormData.basePrice) *
                      (1 +
                        (Number.parseFloat(
                          waveFormData.priceIncreasePercentage
                        ) /
                          100) *
                          2)
                    ).toFixed(2)} birr`
                  : "Not set"}
              </p>
            </div>
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
