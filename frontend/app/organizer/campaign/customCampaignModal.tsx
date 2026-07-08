/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Users,
  Megaphone,
  Plus,
  Trash,
  Loader2,
  Upload,
  Check,
} from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Event } from "@/types/event";
import PaymentMethodSelector from "@/components/payment/PaymentMethodSelector";
import { normalizeEthiopianPhone } from "@/lib/utils";
import { CreditCard } from "lucide-react";

type CampaignUser = {
  name: string;
  phone: string;
  source?: "manual" | "event" | "top-customer" | "import";
};

interface CustomCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialUsers?: CampaignUser[];
  events?: Event[];
  initialData?: any;
}

export default function CustomCampaignModal({
  isOpen,
  onClose,
  initialUsers,
  events = [],
  initialData,
}: CustomCampaignModalProps) {
  const [manualUsers, setManualUsers] = useState<CampaignUser[]>([]);
  const [eventUsers, setEventUsers] = useState<CampaignUser[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const [campaignTitle, setCampaignTitle] = useState("My Campaign");
  const [message, setMessage] = useState("");
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pricing, setPricing] = useState({ sms: 5 });

  const [paymentPhone, setPaymentPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Telebirr");
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [isPooling, setIsPooling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFinalizingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      isFinalizingRef.current = false;
    }
    if (isOpen && initialData) {
      setCampaignTitle(initialData.title || "My Campaign");
      setMessage(initialData.message || "");
      if (initialData.targetedEvents) {
        const ids = initialData.targetedEvents.map((e: any) =>
          typeof e === "string" ? e : e.eventId,
        );
        setSelectedEventIds(ids);
      }
      if (initialData.recipients) {
        setManualUsers(
          initialData.recipients
            .filter((r: any) => r.source !== "event")
            .map((r: any) => ({
              ...r,
              phone: normalizeEthiopianPhone(r.phone) || r.phone,
            })),
        );
      }
    } else if (isOpen && !initialData) {
      setCampaignTitle("My Campaign");
      setMessage("");
      setSelectedEventIds([]);
      setManualUsers([]);
      setTransactionId(null);
      setIsPooling(false);
    }
  }, [isOpen, initialData]);

  useEffect(() => {
    if (isOpen && !initialData) {
      if (initialUsers) {
        const normalizedInit = initialUsers
          .filter((u) => normalizeEthiopianPhone(u.phone))
          .map((u) => ({
            ...u,
            phone: normalizeEthiopianPhone(u.phone) as string,
            source: u.source || "manual",
          }));
        setManualUsers(normalizedInit);

        if (initialUsers.length > normalizedInit.length) {
          toast.warning(
            `Skipped ${initialUsers.length - normalizedInit.length} users with invalid phone numbers.`,
          );
        }
      }
    }

    if (isOpen) {
      const fetchPricing = async () => {
        try {
          let res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/campaign-pricing/public`
          );

          if (!res.ok) {
            res = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/api/invitation-pricing/public`
            );
          }

          const data = await res.json();
          if (data.data?.smsPrice) setPricing({ sms: data.data.smsPrice });
        } catch (err) {
          console.error("Pricing error", err);
        }
      };

      fetchPricing();
    }
  }, [isOpen, initialUsers, initialData]);
  
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPooling && transactionId) {
      interval = setInterval(async () => {
        try {
          if (isFinalizingRef.current) return;

          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/campaigns/payment/status/${transactionId}`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
            },
          );
          const data = await res.json();

          if (data.success) {
            if (data.status === "PAID") {
              setIsPooling(false);
              if (!isFinalizingRef.current) {
                isFinalizingRef.current = true;
                finalizeCampaign(transactionId);
              }
            } else if (
              data.status === "CANCELLED" ||
              data.status === "FAILED"
            ) {
              setIsPooling(false);
              setIsSubmitting(false);
              toast.error(
                `Payment ${data.status.toLowerCase()}. Please try again.`,
              );
            }
          }
        } catch (e) {
          console.error(e);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isPooling, transactionId]);

  const finalizeCampaign = async (paymentId: string) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/campaigns`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            campaignId: initialData?._id,
            title: campaignTitle,
            message,
            targetedEvents: selectedEventIds.map((id) => ({
              eventId: id,
              eventName: events.find((e) => e._id === id)?.title,
            })),
            recipients: allUsers,
            price: cost,
            paymentId,
          }),
        },
      );

      if (res.ok) {
        toast.success("Campaign Launched Successfully!");
        onClose();
      } else {
        toast.error("Campaign Creation Failed (Payment was successful though)");
      }
    } catch (e) {
      toast.error("Network Error finalizing campaign");
      console.log(e);
    }
  };

  const saveDraft = async () => {
    try {
      setIsSubmitting(true);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/campaigns/draft`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            campaignId: initialData?._id,
            title: campaignTitle,
            message,
            targetedEvents: selectedEventIds.map((id) => ({ eventId: id })),
            recipients: allUsers,
            price: cost,
          }),
        },
      );
      if (res.ok) {
        toast.success("Draft Saved");
        onClose();
      } else {
        toast.error("Failed to save draft");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const fetchAttendees = async () => {
      if (selectedEventIds.length === 0) {
        setEventUsers([]);
        return;
      }

      setLoadingEvents(true);
      const uniqueMap = new Map<string, CampaignUser>();

      try {
        const fetchAllTicketsForEvent = async (id: string) => {
          let allTickets: any[] = [];
          let page = 1;
          let hasMore = true;

          while (hasMore) {
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/event/${id}?page=${page}&limit=500`,
              {
                headers: {
                  Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
              }
            );
            if (response.ok) {
              const data = await response.json();
              allTickets = [...allTickets, ...(data.tickets || [])];
              hasMore = data.hasMore || false;
              page++;
            } else {
              hasMore = false;
            }
          }
          return { tickets: allTickets };
        };

        const promises = selectedEventIds.map((id) => fetchAllTicketsForEvent(id));

        const results = await Promise.all(promises);

        results.forEach((data) => {
          const tickets = data.tickets || [];
          tickets.forEach((t: any) => {
            if (t.user && t.user.phoneNumber) {
              if (t.isOnDoor || t.isInvitation) return;

              const normalized = normalizeEthiopianPhone(t.user.phoneNumber);
              if (!normalized) return;

              const firstName = (t.user.firstName || "").trim();
              const lastName = (t.user.lastName || "").trim();
              const displayName =
                [firstName, lastName].filter(Boolean).join(" ") ||
                t.guestName ||
                "Customer";

              uniqueMap.set(normalized, {
                name: displayName,
                phone: normalized,
                source: "event",
              });
            }
          });
        });

        setEventUsers(Array.from(uniqueMap.values()));
      } catch (err) {
        console.error(err);
        toast.error("Failed to load event attendees");
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchAttendees();
  }, [selectedEventIds]);

  const handleManualAdd = () => {
    if (!newPhone) return toast.error("Phone number is required");

    const normalized = normalizeEthiopianPhone(newPhone);
    if (!normalized)
      return toast.error("Invalid Ethiopian phone number. Use 09/07 or +251");

    if (
      manualUsers.some((u) => u.phone === normalized) ||
      eventUsers.some((u) => u.phone === normalized)
    ) {
      return toast.warning(`Contact ${normalized} is already in the list`);
    }

    setManualUsers([
      ...manualUsers,
      { name: newName || "Guest", phone: normalized, source: "manual" },
    ]);
    setNewPhone("");
    setNewName("");
    setShowPhoneInput(false);
    toast.success("Added user");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      const newUsers: CampaignUser[] = [];
      const currentPhones = new Set(
        [...manualUsers, ...eventUsers].map((u) => u.phone),
      );

      data.forEach((row) => {
        const phone =
          row.Phone || row.phone || row.PhoneNumber || row["Phone Number"];
        const name = row.Name || row.name || row["Full Name"] || "Guest";

        if (phone) {
          const normalized = normalizeEthiopianPhone(String(phone));
          if (normalized && !currentPhones.has(normalized)) {
            newUsers.push({ name: name, phone: normalized, source: "import" });
            currentPhones.add(normalized);
          }
        }
      });

      if (newUsers.length > 0) {
        setManualUsers((prev) => [...prev, ...newUsers]);
        toast.success(`Imported ${newUsers.length} users`);
      } else {
        toast.warning("No new valid contacts found (check phone formats)");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleLaunch = async () => {
    if (!campaignTitle) return toast.error("Campaign title required");
    if (!message) return toast.error("Message required");
    if (allUsers.length === 0) return toast.error("No recipients");

    setShowPaymentDialog(true);
  };

  const processPayment = async () => {
    if (!paymentPhone) return toast.error("Payment phone is required");
    if (paymentPhone.length < 9) return toast.error("Invalid phone length");

    let finalPhone = paymentPhone;

    if (finalPhone.startsWith("0")) {
      finalPhone = finalPhone.substring(1);
    }

    if (!finalPhone.startsWith("251")) finalPhone = "251" + finalPhone;

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");

      let finalMethod = paymentMethod;
      if (paymentMethod.toLowerCase() === "telebirr") finalMethod = "telebirr";
      if (paymentMethod.toLowerCase() === "cbe birr") finalMethod = "cbebirr";
      if (paymentMethod.toLowerCase() === "mpesa") finalMethod = "mpesa";
      if (paymentMethod.toLowerCase().includes("amole")) finalMethod = "amole";

      const billingData = {
        amount: cost,
        paymentReason: `Campaign: ${campaignTitle}`,
        phoneNumber: finalPhone,
        paymentMethod: finalMethod,
        campaignId: "new",
      };

      const paymentResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/campaigns/payment/initiate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(billingData),
        },
      );

      const paymentResult = await paymentResponse.json();

      if (paymentResponse.ok) {
        toast.success("Payment initiated! Check your phone.");
        setTransactionId(paymentResult.transactionId);
        setIsPooling(true);
      } else {
        toast.error("Payment failed: " + paymentResult.message);
        setIsSubmitting(false);
      }
    } catch (err) {
      toast.error("Payment processing failed");
      console.log(err);
      setIsSubmitting(false);
    }
  };

  const allUsers = useMemo(() => {
    const map = new Map();
    [...manualUsers, ...eventUsers].forEach((u) => map.set(u.phone, u));
    return Array.from(map.values()) as CampaignUser[];
  }, [manualUsers, eventUsers]);

  const cost = allUsers.length * pricing.sms;

  const toggleEvent = (eventId: string, checked: boolean) => {
    if (checked) {
      setSelectedEventIds((prev) => [...prev, eventId]);
    } else {
      setSelectedEventIds((prev) => prev.filter((id) => id !== eventId));
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[950px] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden outline-none bg-white dark:bg-black">
        {/* Header */}
        <div className="p-6 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2 dark:text-gray-100">
              <Megaphone className="text-blue-600 dark:text-blue-400" />
              Create Campaign
            </DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Select events to retarget attendees or upload a custom list.
            </DialogDescription>
          </div>
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <Upload size={16} className="mr-2" />
              Import EXCl/CSV
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Selection & Message */}
          <div className="w-1/2 flex flex-col bg-gray-50/50 dark:bg-gray-900/30 border-r border-gray-100 dark:border-gray-800">
            {/* Event Selector */}
            <div className="p-6 pb-2">
              <Label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-2">
                Campaign Title <span className="text-red-500">*</span>
              </Label>
              <Input
                value={campaignTitle}
                onChange={(e) => setCampaignTitle(e.target.value)}
                placeholder="e.g. Summer Concert Promo"
                className="mb-4 dark:bg-black dark:border-gray-700 dark:text-gray-100"
              />

              <Label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-3">
                Select Target Events
              </Label>
              <ScrollArea className="h-[200px] bg-white dark:bg-black rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="p-3 space-y-2">
                  {events.map((event) => (
                    <div
                      key={event._id}
                      className="flex items-center space-x-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
                    >
                      <Checkbox
                        id={event._id}
                        checked={selectedEventIds.includes(event._id)}
                        onCheckedChange={(c) =>
                          toggleEvent(event._id, c as boolean)
                        }
                        className="dark:border-gray-600"
                      />
                      <label
                        htmlFor={event._id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1 dark:text-gray-200"
                      >
                        {event.title}
                      </label>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(event.startDate || "").toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                  {events.length === 0 && (
                    <p className="text-xs text-center text-gray-400 dark:text-gray-500 py-4">
                      No events found.
                    </p>
                  )}
                </div>
              </ScrollArea>
              <div className="flex justify-between items-center mt-2 px-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedEventIds.length} event(s) selected
                </span>
                {loadingEvents && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 animate-pulse">
                    Fetching attendees...
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 px-6 pb-6 pt-2 h-full flex flex-col">
              <Label className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                Campaign Message
                <span className="text-red-500 text-xs font-normal bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
                  * Required
                </span>
              </Label>
              <div className="flex-1 bg-white dark:bg-black rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-1 focus-within:border-blue-400 dark:focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-50 dark:focus-within:ring-blue-900/30 transition-all">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message here... (e.g., 'Don't miss out on our biggest event of the year! Get your tickets now.')"
                  className="w-full h-full min-h-[150px] border-0 focus-visible:ring-0 resize-none text-base p-4 placeholder:text-gray-300 dark:placeholder:text-gray-600 dark:text-gray-100"
                />
              </div>
              <div className="flex justify-between items-center mt-2 px-1">
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Avoid special characters for better delivery.
                </span>
                <div className="text-right text-xs text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-md">
                  {message.length} characters
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Stats & List */}
          <div className="w-1/2 flex flex-col bg-white dark:bg-black">
            <div className="bg-blue-50/30 dark:bg-blue-900/10 p-4 border-b border-gray-100 dark:border-gray-800 space-y-3">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-gray-800 dark:text-gray-200">
                  Total Recipients
                </span>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {allUsers.length}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
                <span>Estimated Cost ({pricing.sms} ETB/SMS)</span>
                <span>{cost.toFixed(2)} ETB</span>
              </div>
            </div>

            <div className="p-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-black flex justify-between items-center sticky top-0 z-10">
              <span className="text-sm font-semibold text-gray-600 dark:text-gray-400 pl-2">
                Included Contacts
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 h-8"
                onClick={() => setShowPhoneInput(!showPhoneInput)}
              >
                <Plus size={16} className="mr-1" /> Add Manual
              </Button>
            </div>

            {showPhoneInput && (
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800 flex flex-col gap-2 animate-in slide-in-from-top-2">
                <Input
                  placeholder="Name (Optional)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="bg-white dark:bg-black h-9 dark:border-gray-700 dark:text-gray-100"
                />
                <div className="flex gap-2">
                  <Input
                    placeholder="Phone (09...)"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="bg-white dark:bg-black h-9 dark:border-gray-700 dark:text-gray-100"
                  />
                  <Button size="sm" onClick={handleManualAdd}>
                    Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowPhoneInput(false)}
                    className="dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto min-h-0 bg-white dark:bg-black">
              <div className="p-2 space-y-1">
                {allUsers.map((u, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg group border border-transparent hover:border-gray-100 dark:hover:border-gray-700 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs ring-2 ring-transparent group-hover:ring-indigo-100 dark:group-hover:ring-indigo-800/50 transition-all">
                        {u.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {u.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{u.phone}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        if (manualUsers.includes(u)) {
                          setManualUsers(manualUsers.filter((m) => m !== u));
                        }
                        setEventUsers((prev) =>
                          prev.filter((e) => e.phone !== u.phone),
                        );
                        setManualUsers((prev) =>
                          prev.filter((m) => m.phone !== u.phone),
                        );
                      }}
                    >
                      <Trash size={14} />
                    </Button>
                  </div>
                ))}
                {allUsers.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-48 text-gray-300 dark:text-gray-600">
                    <Users size={48} className="mb-3 opacity-20" />
                    <p className="text-sm">Select an event or add contacts</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer / Payment Section */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 flex justify-between gap-3 shadow-[0_-4px_10px_-5px_rgba(0,0,0,0.1)] z-20">
              <Button
                variant="ghost"
                onClick={saveDraft}
                disabled={isSubmitting || !campaignTitle}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              >
                Save as Draft
              </Button>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="border-gray-300 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleLaunch}
                  disabled={
                    isSubmitting ||
                    allUsers.length === 0 ||
                    !message ||
                    !campaignTitle
                  }
                  className="bg-[#0D47A1] hover:bg-[#0D47A1]/90 dark:bg-yellow-400 dark:text-black dark:hover:bg-yellow-400/90 min-w-[180px] shadow-lg shadow-blue-200 dark:shadow-yellow-900/20 h-11 text-base"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Megaphone className="mr-2 h-5 w-5" />
                      Proceed to Payment
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Separate Payment Dialog */}
        <Dialog
          open={showPaymentDialog}
          onOpenChange={(open) =>
            !isSubmitting && !isPooling && setShowPaymentDialog(open)
          }
        >
          <DialogContent className="sm:max-w-[425px] dark:bg-black dark:border-gray-800">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 dark:text-gray-100">
                <CreditCard className="text-blue-600 dark:text-blue-400" />
                Complete Payment
              </DialogTitle>
              <DialogDescription className="dark:text-gray-400">
                Review the total cost and choose your payment method.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex justify-between items-center">
                <span className="text-sm font-medium text-blue-900 dark:text-blue-300">
                  Total Campaign Cost
                </span>
                <span className="text-xl font-bold text-blue-700 dark:text-blue-400">
                  {cost.toFixed(2)} ETB
                </span>
              </div>

              <div className="space-y-2">
                <Label className="dark:text-gray-300">Payment Phone Number</Label>
                <div className="flex gap-2">
                  <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm text-gray-500 dark:text-gray-400 font-medium flex items-center">
                    +251
                  </div>
                  <Input
                    value={paymentPhone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "");
                      setPaymentPhone(val);
                    }}
                    placeholder="911223344"
                    className="dark:bg-black dark:border-gray-700 dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="dark:text-gray-300">Select Provider</Label>
                <PaymentMethodSelector
                  selectedMethod={paymentMethod}
                  onSelect={setPaymentMethod}
                  phoneNumber={paymentPhone}
                  provider="SANTIM"
                />
              </div>
            </div>

            <div className="flex-1 justify-end gap-3 flex">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPaymentDialog(false);
                  setIsSubmitting(false);
                  setIsPooling(false);
                  setTransactionId(null);
                }}
                className="dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Back
              </Button>
              <Button
                onClick={processPayment}
                disabled={isSubmitting || isPooling}
                className="bg-[#0D47A1] hover:bg-[#0D47A1]/90 dark:bg-yellow-400 dark:text-black dark:hover:bg-yellow-400/90 text-white min-w-[140px]"
              >
                {isPooling ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    Confirming...
                  </>
                ) : isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    Processing
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Pay & Send
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}