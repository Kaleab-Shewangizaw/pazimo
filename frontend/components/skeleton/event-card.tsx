import Image from "next/image"
import { Heart } from "lucide-react"

interface EventCardProps {
  id: string
  image: string
  venue: string
  title: string
  price: number
}

export default function EventCard({ id, image, venue, title, price }: EventCardProps) {
  return (
    <div className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="relative">
        <Image
          src={image || "/placeholder.svg"}
          alt={title}
          width={400}
          height={300}
          className="w-full h-48 object-cover"
        />
        <button className="absolute top-3 right-3 bg-white/80 p-1.5 rounded-full hover:bg-white">
          <Heart className="h-5 w-5 text-gray-600 hover:text-red-500" />
        </button>

        
      </div>
      <div className="p-4">
        <p className="text-sm text-gray-500">{venue}</p>
        <h3 className="font-semibold text-lg mt-1">{title}</h3>
        <p className="text-[#0D47A1] font-bold mt-2">Price - {price}</p>
      </div>
    </div>
  )
}
