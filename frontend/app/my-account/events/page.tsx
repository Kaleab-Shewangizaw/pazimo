import Image from "next/image"
import { CalendarDays, Clock, MapPin, Share2, Heart, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

// In a real app, this would fetch data based on the event ID
export default function EventDetailsPage({ params }: { params: { id: string } }) {
  // Mock data - would come from API/database in a real app
  const event = {
    id: params.id,
    title: "The Lab Event",
    venue: "The Venue Warehouse",
    price: "$192.00",
    date: "September 29, 2023",
    time: "9:00 PM - 2:00 AM",
    location: "123 Main Street, Downtown",
    image: "/placeholder.svg?height=600&width=600",
    description: `Get ready to experience an unforgettable night of music, drinks, and high-energy vibes! Join us at Beats & Brews Night, where top DJs from around the city will take turns on the decks, bringing you the best beats in electronic, house, and hip-hop.

Sip on refreshing cocktails and exclusive drink specials crafted just for the night as you dance the night away with friends and fellow music lovers. With diverse DJs and a wide selection of drinks, this event promises a night of non-stop fun. Don't miss out on this electrifying experience – grab your tickets now!.`,
    features: ["Free Drinks", "Free Hookah", "Free Parking", "Guest Star DJs"],
    status: "Active",
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">EVENT DETAILS</h1>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Event Image */}
        <div className="bg-black rounded-lg overflow-hidden shadow-lg">
          <Image
            src={event.image || "/placeholder.svg"}
            alt={event.title}
            width={800}
            height={800}
            className="w-full h-auto object-cover"
            priority
          />
        </div>

        {/* Event Info */}
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between items-start">
              <h2 className="text-3xl font-bold text-gray-900">{event.title}</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" className="rounded-full">
                  <Heart className="h-5 w-5" />
                  <span className="sr-only">Add to wishlist</span>
                </Button>
                <Button variant="outline" size="icon" className="rounded-full">
                  <Share2 className="h-5 w-5" />
                  <span className="sr-only">Share event</span>
                </Button>
              </div>
            </div>
            <p className="text-xl text-gray-700">{event.venue}</p>
          </div>

          <div className="flex items-center text-3xl font-bold text-gray-900">
            {event.price}
            {event.status && (
              <Badge variant={event.status === "Active" ? "default" : "secondary"} className="ml-4">
                {event.status}
              </Badge>
            )}
          </div>

          <div className="grid gap-4 text-gray-700">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-gray-500" />
              <span>{event.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-500" />
              <span>{event.time}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-gray-500" />
              <span>{event.location}</span>
            </div>
          </div>

          <div className="prose max-w-none">
            <p className="text-gray-700 leading-relaxed">{event.description}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {event.features.map((feature, index) => (
              <Badge key={index} variant="outline" className="bg-gray-100 text-gray-800 font-medium py-1 px-3">
                {feature}
              </Badge>
            ))}
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-4">
            <Button size="lg" className="flex-1">
              Buy Tickets
            </Button>
            <Button variant="outline" size="lg" className="flex-1">
              <Download className="mr-2 h-5 w-5" />
              Download Ticket
            </Button>
          </div>

          <div className="border-t border-gray-200 pt-6 mt-6">
            <h3 className="font-semibold text-lg mb-4">Scan to share</h3>
            <div className="bg-white p-4 inline-block rounded-lg border">
              <Image
                src="/placeholder.svg?height=150&width=150"
                alt="QR Code"
                width={150}
                height={150}
                className="w-32 h-32"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
