"use client";

import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Event } from "@/types/event";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@radix-ui/react-dialog";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { Megaphone, Ticket, Trash, User } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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

  useEffect(() => {
    const fetchTickets = async () => {
      if (!selectedEventId) {
        setTickets([]);
        return;
      }

      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/event/${selectedEventId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          setTickets(data.tickets || []);
        } else {
          setTickets([]);
          toast.error("Failed to load tickets");
        }
      } catch (error) {
        console.error("Error fetching tickets:", error);
        toast.error("Error loading customers");
        setTickets([]);
      }
    };

    fetchTickets();
  }, [selectedEventId]);

  const filterTickets = (): UniqueUser[] => {
    const filteredTickets = tickets.filter((ticket) => {
      return !ticket.isOnDoor && !ticket.isInvitation;
    });

    const uniqueSet = new Set<string>();
    filteredTickets.forEach((ticket) => {
      const userObj = {
        username: ticket.user.fullName,
        phone: ticket.user.phoneNumber,
      };
      uniqueSet.add(JSON.stringify(userObj));
    });

    const result = Array.from(uniqueSet).map(
      (item) => JSON.parse(item) as UniqueUser,
    );
    return result;
  };

  return (
    <div
      className="group flex items-center justify-between p-5 mb-4 
             bg-white border border-gray-200 rounded-xl shadow-sm 
             hover:shadow-md hover:border-blue-300 transition-all duration-200"
    >
      <div className="flex flex-col gap-1">
        <h3 className="font-bold text-xl text-gray-800 tracking-tight">
          {event.title}
        </h3>
        <p className="text-sm text-gray-500">
          {filterTickets().length} phone number
        </p>
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <button
            className="flex items-center justify-center p-3 rounded-xl
             bg-blue-600 text-white shadow-lg shadow-blue-200/50
             hover:bg-blue-700 hover:scale-105 active:scale-95
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

        {/* Fixed height (h-[600px]) and width (max-w-[550px]) to make it look "Bigger" */}
        <DialogContent className="sm:max-w-[550px] h-full w-300 flex flex-col p-0 overflow-hidden absolute -top-10 left-1/2 -translate-x-1/2  bg-white border-none shadow-2xl">
          {/* Header Section */}
          <div className="p-6 pb-4">
            <DialogHeader>
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                <Megaphone className="text-blue-600" size={24} />
              </div>
              <DialogTitle className="text-2xl font-bold">
                {" "}
                {/* Larger Title */}
                Create Campaign
              </DialogTitle>
              <DialogDescription className="text-gray-500 mt-1 text-base">
                Targeting attendees of{" "}
                <span className="font-semibold text-blue-600 italic">
                  {event.title}
                </span>
              </DialogDescription>
            </DialogHeader>
          </div>

          <Separator />

          {/* Scroll Area - flex-1 makes it take up all space between header and footer */}
          <div className="flex-1 overflow-hidden flex flex-col bg-gray-50/30">
            <ScrollArea className="h-full px-6">
              <div className="space-y-3 py-4">
                {filterTickets().length > 0 ? (
                  filterTickets().map((user) => (
                    <div
                      key={user.phone}
                      className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white shadow-sm hover:border-blue-300 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <User size={20} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 leading-none">
                            {user.username}
                          </p>
                          <p className="text-xs text-gray-500 mt-1 font-mono">
                            {user.phone}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-gray-400 hover:text-red-600 hover:bg-red-50 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash size={18} />
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                    <User size={48} className="mb-2 opacity-20" />
                    <p>No users found for this event.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <Separator />

          {/* Footer - Pinned to bottom */}
          <DialogFooter className="p-6 bg-white flex flex-row sm:justify-between items-center shrink-0">
            <div className="flex flex-col">
              <p className="text-sm font-semibold text-gray-900">
                {filterTickets().length} Users
              </p>
              <p className="text-xs text-gray-500">Selected for campaign</p>
            </div>
            <div className="flex gap-3">
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button className="bg-blue-600 hover:bg-blue-700 px-6 shadow-md shadow-blue-200">
                Launch Campaign
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
