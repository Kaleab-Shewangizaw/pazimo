import TicketDetailClient from "./TicketDetailClient";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  return <TicketDetailClient ticketId={ticketId} />;
}
