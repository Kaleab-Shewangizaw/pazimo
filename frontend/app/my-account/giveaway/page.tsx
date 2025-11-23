import { Progress } from "@/components/ui/progress"

export default function GiveawayPage() {
  // In a real app, this would come from an API or database
  const eventsJoined = 1
  const totalEvents = 10
  const progressPercentage = (eventsJoined / totalEvents) * 100

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-12">Give Away</h1>

      <div className="max-w-2xl mx-auto">
        <Progress value={progressPercentage} className="h-2" />

        <p className="text-lg font-medium mt-6">
          {eventsJoined} out {totalEvents} events joined to the giveaway
        </p>

        <div className="mt-12 bg-gray-50 p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-4">Upcoming Giveaways</h2>
          <p className="text-gray-600">Join more events to increase your chances of winning exclusive prizes!</p>
        </div>
      </div>
    </div>
  )
}
