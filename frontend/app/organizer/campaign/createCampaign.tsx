"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Crown, TrendingUp, Megaphone } from "lucide-react";

import CustomCampaignModal from "./customCampaignModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TopCustomer {
  phone: string;
  name: string;
  totalTickets: number;
  totalSpent: number;
  eventsCount: number;
}

interface CampaignUser {
  name: string;
  phone: string;
}

export default function CreateCampaignPage() {
  const [events, setEvents] = useState();

  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [limit, setLimit] = useState("10");

  const [showCustomCampaign, setShowCustomCampaign] = useState(false);
  const [customUsers, setCustomUsers] = useState<CampaignUser[]>([]);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const token = localStorage.getItem("token");
        const userId = localStorage.getItem("userId");

        if (!token || !userId) {
          toast.error("Authentication required");
          return;
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/events/organizer/${userId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          const allEvents = data.events || data.data || [];
          setEvents(allEvents);
        } else {
          toast.error("Failed to load events");
        }
      } catch (error) {
        console.error("Error fetching events:", error);
      }
    };

    fetchEvents();
  }, []);

  useEffect(() => {
    const fetchTopCustomers = async () => {
      try {
        const token = localStorage.getItem("token");
        const userId = localStorage.getItem("userId");
        if (!userId) return;

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/organizers/${userId}/top-customers?limit=${limit}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          const validCustomers = (data.data || []).filter((c: TopCustomer) => {
            return c.phone && c.phone.length >= 9;
          });
          setTopCustomers(validCustomers);
        }
      } catch (error) {
        console.error("Error fetching top customers:", error);
      }
    };

    if (localStorage.getItem("userId")) {
      fetchTopCustomers();
    }
  }, [limit]);

  return (
    <div className="w-full h-full flex bg-white dark:bg-black rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
      <CustomCampaignModal
        isOpen={showCustomCampaign}
        onClose={() => setShowCustomCampaign(false)}
        initialUsers={customUsers}
        events={events || []}
      />

      {/* Left Panel - Hero Section */}
      <div className="w-1/2 relative overflow-hidden flex flex-col justify-center p-12 text-white bg-gradient-to-br from-indigo-600 via-blue-600 to-blue-500">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <filter id="noiseFilter">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.65"
                numOctaves="3"
                stitchTiles="stitch"
              />
            </filter>
            <rect width="100%" height="100%" filter="url(#noiseFilter)" />
          </svg>
        </div>

        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-400/30 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/30 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <div className="absolute top-24 right-12 animate-in slide-in-from-right-10 duration-1000 hidden xl:block pointer-events-none">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl rounded-tr-sm shadow-2xl max-w-[260px] rotate-6 transition-transform cursor-default">
            <div className="flex gap-3 mb-3 items-center">
              <div className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center text-white font-bold text-xs ring-4 ring-white/10">
                P
              </div>
              <div>
                <div className="font-bold text-sm text-blue-50">Pazimo</div>
                <div className="text-[10px] text-blue-200">Just now</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-2 w-24 bg-white/40 rounded-full"></div>
              <div className="h-2 w-full bg-white/20 rounded-full"></div>
              <div className="h-2 w-3/4 bg-white/20 rounded-full"></div>
            </div>
          </div>

          <div className="mt-4 bg-white/5 backdrop-blur-sm border border-white/10 p-3 rounded-2xl rounded-tl-sm shadow-lg max-w-[200px] -rotate-3 ml-12 transition-transform">
            <div className="flex gap-2 items-center mb-2">
              <div className="w-6 h-6 rounded-full bg-green-400 flex items-center justify-center text-green-800 font-bold text-[10px]">
                E
              </div>
              <span className="text-[10px] text-blue-200">Event Alert</span>
            </div>
            <div className="h-1.5 w-full bg-white/20 rounded-full"></div>
          </div>
        </div>

        <div className="relative z-10 space-y-8 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg text-xs font-semibold uppercase tracking-wider text-blue-50">
            <Megaphone
              size={32}
              className="h-15 w-15 group-hover:scale-110 transition-transform "
            />
          </div>

          <div>
            <h1 className="text-5xl font-extrabold tracking-tight leading-tight mb-4 drop-shadow-sm">
              Engage your fans <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
                like never before.
              </span>
            </h1>
            <p className="text-lg text-blue-100 leading-relaxed font-light border-l-4 border-blue-400/50 pl-4">
              Don&apos;t wait for them to check social media. Send targeted SMS
              campaigns directly to their phones for new events, discounts, and
              updates.
            </p>
          </div>

          <div className="flex gap-5 pt-2 items-center">
            <Button
              size="lg"
              onClick={() => {
                setCustomUsers([]);
                setShowCustomCampaign(true);
              }}
              className="h-14 px-8 text-lg bg-white text-blue-700 hover:bg-blue-50 border-0 shadow-xl hover:shadow-blue-900/20 hover:-translate-y-1 transition-all rounded-xl font-bold group"
            >
              <Megaphone className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
              Start Campaign
            </Button>
          </div>
        </div>
      </div>

      {/* Right Panel - Top Customers */}
      <div className="w-1/2 flex flex-col h-full bg-white dark:bg-black">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-black shrink-0">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-xl flex items-center gap-2">
              <Crown className="text-yellow-500 fill-yellow-500" size={24} />
              Top Customers
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Your most loyal attendees based on ticket sales.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Top:</span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                max="1000"
                placeholder="10"
                className="w-[80px] h-9 text-center bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 focus:bg-white dark:focus:bg-black text-gray-900 dark:text-gray-100 transition-colors"
                value={limit}
                onChange={(e) => {
                  const val = e.target.value;
                  if (
                    val === "" ||
                    (parseInt(val) > 0 && parseInt(val) <= 1000)
                  ) {
                    setLimit(val);
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto p-0">
          {topCustomers.length > 0 ? (
            <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {topCustomers.map((customer, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group px-6"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`
                        w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                        ${i < 3 ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 ring-2 ring-yellow-500/20" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"}
                    `}
                    >
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {customer.name || "Customer"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                        {customer.phone}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <span className="block font-bold text-gray-900 dark:text-gray-100">
                        {customer.eventsCount}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Events</span>
                    </div>
                    <div className="text-right w-16">
                      <span className="block font-bold text-blue-600 dark:text-blue-400">
                        {customer.totalTickets}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Tickets</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 text-gray-400 dark:text-gray-500 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-full">
                <TrendingUp size={32} className="opacity-20 text-gray-500 dark:text-gray-400" />
              </div>
              <div>
                <p className="font-medium text-gray-600 dark:text-gray-400">
                  No customer data yet
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  Once you sell tickets, your top fans will appear here.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Action */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/20">
          <Button
            size="lg"
            className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white shadow-md transition-all h-12 text-base"
            onClick={() => {
              const users = topCustomers.map((c) => ({
                name: c.name || "Customer",
                phone: c.phone,
              }));
              setCustomUsers(users);
              setShowCustomCampaign(true);
            }}
            disabled={topCustomers.length === 0}
          >
            <Crown className="w-5 h-5 mr-2 text-yellow-300 fill-yellow-300" />
            Create Campaign for Top {topCustomers.length} Fans
          </Button>
        </div>
      </div>
    </div>
  );
}