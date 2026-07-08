"use client";

import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Event } from "@/types/event";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Megaphone, Plus, Ticket, Trash, User, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import router from "next/router";
import { useRouter } from "next/navigation";

type Ticket = {
  _id: string;
  isOnDoor: boolean;
  isInvitation: boolean;
  user: {
    fullName: string;
    phoneNumber: string;
  };
};

type UniqueUser = {
  username: string;
  phone: string;
};

export default function TableComp({ event }: { event: Event }) {
  const selectedEventId = event._id;
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [message, setMessage] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [manualUsers, setManualUsers] = useState<UniqueUser[]>([]);
  const [pricing, setPricing] = useState({ sms: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedEventId) {
        setTickets([]);
        return;
      }

      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        let allTickets: any[] = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          const ticketsResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/event/${selectedEventId}?page=${page}&limit=500`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          );

          if (ticketsResponse.ok) {
            const data = await ticketsResponse.json();
            allTickets = [...allTickets, ...(data.tickets || [])];
            hasMore = data.hasMore || false;
            page++;
          } else {
            hasMore = false;
            if (page === 1) {
              toast.error("Failed to load tickets");
            }
          }
        }

        setTickets(allTickets);

        let pricingResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/campaign-pricing/public`,
        );

        if (!pricingResponse.ok) {
          pricingResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/invitation-pricing/public`,
          );
        }

        if (pricingResponse.ok) {
          const data = await pricingResponse.json();
          setPricing({ sms: data.data?.smsPrice || 5 });
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Error loading data");
        setTickets([]);
      }
    };

    fetchData();
  }, [selectedEventId]);

  const filterTickets = (): UniqueUser[] => {
    const filteredTickets = tickets.filter((ticket) => {
      return !ticket.isOnDoor && !ticket.isInvitation;
    });

    const uniqueSet = new Set<string>();
    filteredTickets.forEach((ticket) => {
      if (ticket.user && ticket.user.phoneNumber) {
        const userObj = {
          username: ticket.user.fullName || "User",
          phone: ticket.user.phoneNumber,
        };
        uniqueSet.add(JSON.stringify(userObj));
      }
    });

    const result = Array.from(uniqueSet).map(
      (item) => JSON.parse(item) as UniqueUser,
    );
    return result;
  };

  const getTargetUsers = () => {
    return [...filterTickets(), ...manualUsers];
  };

  const handleAddUser = () => {
    if (!newPhone) {
      toast.error("Phone number is required");
      return;
    }
    const phoneRegex = /^(\+251|0)(9|7)\d{8}$/;
    if (!phoneRegex.test(newPhone)) {
      toast.error("Invalid Ethiopian phone number format");
      return;
    }

    const newUser: UniqueUser = {
      username: "Manual User",
      phone: newPhone,
    };

    const exists = getTargetUsers().some((u) => u.phone === newPhone);
    if (exists) {
      toast.error("User already in list");
      return;
    }

    setManualUsers([...manualUsers, newUser]);
    setNewPhone("");
    setShowInput(false);
    toast.success("User added to list");
  };

  const handleLaunchCampaign = async () => {
    const users = getTargetUsers();
    if (users.length === 0) {
      toast.error("No users selected");
      return;
    }
    if (!message.trim()) {
      toast.error("Please enter a campaign message");
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem("token");
      const rows = users.map((u) => ({
        guestName: u.username,
        guestPhone: u.phone,
        type: "sms",
        amount: 1,
        message: message,
      }));

      const createResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/invitations/bulk-create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            eventId: event._id,
            rows: rows,
          }),
        },
      );

      const createData = await createResponse.json();

      if (!createResponse.ok) {
        throw new Error(createData.message || "Failed to create campaign");
      }

      const { invitationIds, totalCost } = createData.data;

      const billingData = {
        amount: totalCost,
        paymentReason: `Campaign for ${event.title}`,
        phoneNumber: "",
        paymentMethod: "Telebirr",
        invitationData: {
          customerName: "Campaign Manager",
          contact: "campaign@pazimo.com",
          contactType: "email",
          type: "bulk_invitation_fee",
          qrCodeCount: users.length,
          eventId: event._id,
          pendingInvitationIds: invitationIds,
          message: message,
        },
      };

      const phone = prompt("Enter Telebirr number for payment:");
      if (!phone) {
        setIsSubmitting(false);
        return;
      }

      const paymentResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/invitations/payment/initiate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...billingData,
            phoneNumber: phone,
          }),
        },
      );

      const paymentResult = await paymentResponse.json();

      if (paymentResponse.ok) {
        toast.success(
          "Payment initiated! Please check your phone to confirm transaction.",
        );
        const txId = paymentResult.transactionId;
        const interval = setInterval(async () => {
          const check = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/invitations/payment/status/${txId}`,
          );
          const checkData = await check.json();
          if (checkData.status === "PAID") {
            clearInterval(interval);
            toast.success("Payment successful! Campaign sending...");
          }
        }, 3000);
      } else {
        toast.error("Payment initiation failed: " + paymentResult.message);
      }
    } catch (error) {
      console.error("Campaign handling error:", error);
      toast.error(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const users = getTargetUsers();
  const totalCost = users.length * pricing.sms * 1.03;

  return (
    <div
      className="group flex items-center justify-between p-5 mb-4 
             bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm 
             hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200"
    >
      <div className="flex flex-col gap-1">
        <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100 tracking-tight">
          {event.title}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {filterTickets().length} potential recipients
        </p>
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <button
            className="flex items-center justify-center p-3 rounded-xl
             bg-[#0D47A1] text-white shadow-lg shadow-blue-200/50 dark:bg-yellow-400 dark:text-black dark:shadow-yellow-900/20
             hover:bg-[#0D47A1]/90 dark:hover:bg-yellow-400/90 hover:scale-105 active:scale-95
             transition-all duration-200 cursor-pointer group"
            aria-label="Promote event"
          >
            <Megaphone
              size={24}
              strokeWidth={2}
              className="group-hover:rotate-12 transition-transform"
            />
          </button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-[900px] h-[80vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-black border-gray-200 dark:border-gray-800 shadow-2xl">
          {/* Header Section */}
          <div className="p-6 pb-4 bg-gray-50/50 dark:bg-gray-900/30 border-b border-gray-100 dark:border-gray-800">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <Megaphone className="text-blue-600 dark:text-blue-400" size={24} />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold dark:text-gray-100">
                    Create Campaign
                  </DialogTitle>
                  <DialogDescription className="text-gray-500 dark:text-gray-400 mt-1 text-base">
                    Engage with attendees of{" "}
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {event.title}
                    </span>
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* LEFT COLUMN: Message & Stats */}
            <div className="w-1/2 p-6 flex flex-col gap-6 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-black">
              <div className="flex-1 flex flex-col gap-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Campaign Message
                </label>
                <Textarea
                  placeholder="Type your message here... (e.g., Early bird tickets for our next event are now available!)"
                  className="flex-1 resize-none bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 focus:bg-white dark:focus:bg-black transition-colors text-base p-4 dark:text-gray-100 dark:placeholder-gray-500"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 text-right">
                  {message.length} characters
                </p>
              </div>

              <div className="bg-blue-50/50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-3">
                  Campaign Summary
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Recipients</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {users.length}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Cost per SMS</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {pricing.sms} ETB
                    </span>
                  </div>
                  <Separator className="bg-blue-200/50 dark:bg-blue-800/50" />
                  <div className="flex justify-between text-base font-bold text-blue-700 dark:text-blue-400 pt-1">
                    <span>Estimated Total</span>
                    <span>{totalCost.toFixed(2)} ETB</span>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: User List */}
            <div className="w-1/2 flex flex-col bg-gray-50/30 dark:bg-gray-900/20">
              <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-black">
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  Target Audience
                </span>
                <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded-full">
                  {users.length} added
                </span>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
                <div className="space-y-2 py-2">
                  {/* Add User Row */}
                  <div className="flex items-center justify-between p-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-white/50 dark:bg-black/50 hover:bg-white dark:hover:bg-black hover:border-blue-300 dark:hover:border-blue-700 transition-all group">
                    {showInput ? (
                      <div className="flex flex-1 items-center gap-2">
                        <Input
                          placeholder="Phone (e.g., 0911...)"
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                          className="h-9 dark:bg-black dark:border-gray-700 dark:text-gray-100"
                          autoFocus
                        />
                        <Button size="sm" onClick={handleAddUser}>
                          Add
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowInput(false)}
                          className="dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          X
                        </Button>
                      </div>
                    ) : (
                      <div
                        className="flex flex-1 items-center gap-3 cursor-pointer text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                        onClick={() => setShowInput(true)}
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 flex items-center justify-center transition-colors">
                          <Plus
                            size={16}
                            className="group-hover:text-blue-600 dark:group-hover:text-blue-400"
                          />
                        </div>
                        <span className="text-sm font-medium">
                          Add manual recipient
                        </span>
                      </div>
                    )}
                  </div>

                  {/* List */}
                  {users.map((user, idx) => (
                    <div
                      key={user.phone + idx}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-black shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">
                          {user.username.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-none">
                            {user.username}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
                            {user.phone}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                        onClick={() => {
                          if (manualUsers.includes(user)) {
                            setManualUsers(
                              manualUsers.filter((u) => u !== user),
                            );
                          } else {
                            toast.info("Cannot remove imported users yet");
                          }
                        }}
                      >
                        <Trash size={14} />
                      </Button>
                    </div>
                  ))}

                  {users.length === 0 && (
                    <div className="text-center py-10 text-gray-400 dark:text-gray-500 text-sm">
                      No recipients yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-black border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 z-10">
            <DialogClose asChild>
              <Button variant="outline" className="dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                Cancel
              </Button>
            </DialogClose>
            <Button
              onClick={handleLaunchCampaign}
              className="bg-[#0D47A1] hover:bg-[#0D47A1]/90 dark:bg-yellow-400 dark:text-black dark:hover:bg-yellow-400/90 min-w-[150px]"
              disabled={isSubmitting || users.length === 0}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Launch Campaign
                  <Megaphone className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}