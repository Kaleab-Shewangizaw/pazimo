"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Users,
  Crown,
  TrendingUp,
  Filter,
  Megaphone,
  Sparkles,
  Send,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import CustomCampaignModal from "./customCampaignModal";
import { Button } from "@/components/ui/button";

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
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  // Top Customer States
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [limit, setLimit] = useState("10");

  // Custom Campaign States
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
      } finally {
        setIsLoadingEvents(false);
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
          setTopCustomers(data.data || []);
        }
      } catch (error) {
        console.error("Error fetching top customers:", error);
      }
    };

    if (localStorage.getItem("userId")) {
      fetchTopCustomers();
    }
  }, [limit]);

  const totalReach = events
    ? (events as any[]).reduce(
        (acc: any, curr: any) => acc + (curr.ticketsSold || 0),
        0,
      )
    : 0;

  return (
    <div className="w-full h-[85vh] flex gap-6 p-6 bg-gray-50/50 rounded-3xl border border-gray-100 overflow-hidden relative">
      <CustomCampaignModal
        isOpen={showCustomCampaign}
        onClose={() => setShowCustomCampaign(false)}
        initialUsers={customUsers}
        events={events || []}
      />

      {/* Left Panel - Dashboard (3/5) */}
      <div className="flex-1 flex flex-col gap-6 h-full overflow-y-auto w-3/5">
        {/* Hero Section */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col justify-center items-start gap-6 relative overflow-hidden group min-h-[300px]">
          <div className="absolute right-0 top-0 w-64 h-64 bg-blue-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-100/50 transition-colors" />

          <div className="z-10 space-y-4 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold uppercase tracking-wider">
              <Sparkles size={12} />
              New Feature
            </div>
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">
              Text Your Audience <br />
              <span className="text-blue-600">Directly & Instantly.</span>
            </h1>
            <p className="text-lg text-gray-500 leading-relaxed">
              Create targeted SMS campaigns for your attendees. Select past
              events, import contacts, or reach your top fans directly.
            </p>
          </div>

          <div className="z-10 flex gap-4 mt-2">
            <Button
              size="lg"
              onClick={() => {
                setCustomUsers([]);
                setShowCustomCampaign(true);
              }}
              className="h-12 px-8 text-base bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 hover:shadow-xl transition-all rounded-xl"
            >
              <Megaphone className="mr-2 h-5 w-5" />
              Create New Campaign
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between h-32 hover:border-green-100 transition-colors">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-green-50 rounded-lg text-green-600">
                <TrendingUp size={20} />
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">
                {totalReach.toLocaleString()}
              </p>
              <p className="text-sm text-gray-400 font-medium mt-1">
                Total Reachable Audience
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between h-32 hover:border-blue-100 transition-colors">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <Users size={20} />
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">
                {topCustomers.length}
              </p>
              <p className="text-sm text-gray-400 font-medium mt-1">
                Top Customers Identified
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Top Customers (2/5) */}
      <div className="w-2/5 flex flex-col h-full bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-100 p-2 rounded-lg">
              <Crown size={20} className="text-yellow-600" />
            </div>
            <h3 className="font-bold text-gray-900 text-lg">Top Customers</h3>
          </div>
          <div className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
            Top {limit}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {topCustomers.length > 0 ? (
            topCustomers.map((customer, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center font-bold text-blue-600">
                    {customer.name?.[0]?.toUpperCase() || "C"}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm line-clamp-1">
                      {customer.name || "Customer"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {customer.eventsCount} events • {customer.totalTickets}{" "}
                      tix
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 text-gray-400 space-y-2">
              <Users size={32} className="opacity-20" />
              <p>No customer data yet</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <Button
            className="w-full bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 shadow-sm"
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
            <Crown className="w-4 h-4 mr-2 text-yellow-500" />
            Target These Fans
          </Button>
        </div>
      </div>
    </div>
  );
}
