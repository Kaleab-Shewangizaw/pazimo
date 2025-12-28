"use client";

import { use } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useEventStore } from "@/store/eventStore";
import { useAuthStore } from "@/store/authStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calendar, MapPin, Users, Clock, Tag } from "lucide-react";
import Image from "next/image";

interface Event {
  _id: string;
  title: string;
  description: string;
  category: { _id: string; name: string } | string;
  startDate: string;
  endDate: string;
  location: {
    address: string;
    city: string;
    country: string;
  };
  capacity: number;
  ticketTypes: Array<{
    name: string;
    price: number;
    quantity: number;
    description: string;
  }>;
  tags: string[];
  status: string;
  coverImages: string[];
}

export default function EventDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const eventId = resolvedParams.id;

  const router = useRouter();
  const { currentEvent, fetchEvent, isLoading } = useEventStore();
  const { isAuthenticated, token } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !token) {
      toast.error("Please login to view event details");
      router.push("/sign-in");
      return;
    }

    fetchEvent(eventId);
  }, [eventId, isAuthenticated, token, router, fetchEvent]);

  if (!isAuthenticated || !token) {
    return null;
  }

  if (isLoading) {
    return <div className="container mx-auto py-8">Loading...</div>;
  }

  if (!currentEvent) {
    return <div className="container mx-auto py-8">Event not found</div>;
  }

  const getCoverImageUrl = () => {
    if (!currentEvent.coverImages?.[0]) return "/placeholder-event.jpg";
    const img = currentEvent.coverImages[0];
    return img.startsWith("http")
      ? img
      : `${process.env.NEXT_PUBLIC_API_URL}${
          img.startsWith("/") ? img : `/${img}`
        }`;
  };

  const categoryName =
    typeof currentEvent.category === "string"
      ? currentEvent.category
      : currentEvent.category?.name || "Uncategorized";

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Event Details</CardTitle>
          <Badge
            className={`absolute top-4 right-4 ${
              currentEvent.status === "published"
                ? "bg-green-500"
                : currentEvent.status === "draft"
                ? "bg-gray-500"
                : "bg-red-500"
            }`}
          >
            {currentEvent.status.charAt(0).toUpperCase() +
              currentEvent.status.slice(1)}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="relative w-full h-100 mb-6">
              <Image
                fill
                src={getCoverImageUrl()}
                alt={currentEvent.title}
                className="object-contain rounded-lg"
                priority
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold">{currentEvent.title}</h2>
                  <p className="text-gray-600 mt-2">
                    {currentEvent.description}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center text-gray-600">
                    <Calendar className="h-4 w-4 mr-2" />
                    <span>
                      {new Date(currentEvent.startDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Clock className="h-4 w-4 mr-2" />
                    <span>
                      {new Date(currentEvent.startDate).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <MapPin className="h-4 w-4 mr-2" />
                    <span>
                      {currentEvent.location.address},{" "}
                      {currentEvent.location.city}
                    </span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Users className="h-4 w-4 mr-2" />
                    <span>{currentEvent.capacity} capacity</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Tag className="h-4 w-4 mr-2" />
                    <div className="flex flex-wrap gap-2">
                      {currentEvent.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4">
                    <Badge variant="secondary">{categoryName}</Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Ticket Types</h3>
                <div className="space-y-4">
                  {currentEvent.ticketTypes.length === 0 ? (
                    <p className="text-gray-500">
                      No ticket types available yet.
                    </p>
                  ) : (
                    currentEvent.ticketTypes.map((ticket, index) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium">{ticket.name}</h4>
                              <p className="text-gray-600">
                                {ticket.description}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">ETB {ticket.price}</p>
                              <p className="text-sm text-gray-600">
                                {ticket.quantity} available
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
