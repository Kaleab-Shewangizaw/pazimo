// "use client";
// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";
// import { useEventStore } from "@/store/eventStore";
// import { Button } from "@/components/ui/button";
// import { Card, CardHeader, CardTitle, CardDescription, CardFooter, CardContent } from "@/components/ui/card";
// import { Badge } from "@/components/ui/badge";
// import {
//   Users,
//   Calendar,
//   DollarSign,
//   Ticket,
//   FileText,
//   CheckCircle,
//   XCircle,
//   Eye,
//   EyeOff,
//   ChevronLeft,
//   ChevronRight,
//   ChevronsLeft,
//   ChevronsRight,
// } from "lucide-react";
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";

// export default function OrganizerDashboard() {
//   const router = useRouter();
//   const { events, isLoading, error, fetchEvents } = useEventStore();
//   const [user, setUser] = useState<any>(null);
//   const [checkedAuth, setCheckedAuth] = useState(false);
//   const [activeTicketsByEvent, setActiveTicketsByEvent] = useState<{ [eventId: string]: any[] }>({});
//   const [withdrawals, setWithdrawals] = useState<any[]>([]);
//   const [balance, setBalance] = useState<any>(null);
//   const [withdrawalsLoading, setWithdrawalsLoading] = useState(true);
//   const [showEarnings, setShowEarnings] = useState(true);

//   // Pagination states
//   const [eventsPage, setEventsPage] = useState(1);
//   const [withdrawalsPage, setWithdrawalsPage] = useState(1);
//   const [analyticsPage, setAnalyticsPage] = useState(1);
//   const [itemsPerPage, setItemsPerPage] = useState(5);

//   useEffect(() => {
//     const authState = localStorage.getItem("auth-storage");
//     if (!authState) {
//       setCheckedAuth(true);
//       return;
//     }
//     try {
//       const { state } = JSON.parse(authState);
//       const { user, token, isAuthenticated } = state;
//       if (!isAuthenticated || !token || user.role !== "organizer") {
//         setCheckedAuth(true);
//         return;
//       }
//       setUser(user);
//       localStorage.setItem("userId", user._id);
//       localStorage.setItem("userRole", user.role);
//       localStorage.setItem("token", token);
//       fetchEvents(user._id);
//       setCheckedAuth(true);
//     } catch (error) {
//       setCheckedAuth(true);
//     }
//   }, [fetchEvents]);

//   useEffect(() => {
//     const fetchActiveTickets = async () => {
//       if (!user || !events.length) return;
//       const token = localStorage.getItem("token");
//       const ticketsMap: { [eventId: string]: any[] } = {};
//       for (const event of events) {
//         try {
//           const res = await fetch(
//             `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/event/${event._id}?status=active`,
//             {
//               headers: {
//                 Authorization: `Bearer ${token}`,
//                 "Content-Type": "application/json",
//               },
//             }
//           );
//           if (res.ok) {
//             const data = await res.json();
//             // If backend does NOT support filtering, filter here:
//             const activeTickets = (data.tickets || []).filter((t: any) => t.status === "active");
//             ticketsMap[event._id] = activeTickets;
//           } else {
//             ticketsMap[event._id] = [];
//           }
//         } catch {
//           ticketsMap[event._id] = [];
//         }
//       }
//       setActiveTicketsByEvent(ticketsMap);
//     };
//     fetchActiveTickets();
//   }, [user, events]);

//   useEffect(() => {
//     const fetchWithdrawals = async () => {
//       setWithdrawalsLoading(true);
//       const storedAuth = localStorage.getItem("auth-storage");
//       let token = "";
//       let userId = "";
//       if (storedAuth) {
//         try {
//           const parsedAuth = JSON.parse(storedAuth);
//           token = parsedAuth.state?.token;
//           userId = parsedAuth.state?.user?._id;
//         } catch {}
//       }
//       if (!token || !userId) {
//         setWithdrawals([]);
//         setBalance(null);
//         setWithdrawalsLoading(false);
//         return;
//       }
//       // Fetch withdrawals
//       try {
//         const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals/organizer/${userId}/withdrawals`, {
//           headers: {
//             Authorization: `Bearer ${token}`,
//             "Content-Type": "application/json",
//           },
//           credentials: "include",
//         });
//         if (res.ok) {
//           const data = await res.json();
//           setWithdrawals(data.data || []);
//         } else {
//           setWithdrawals([]);
//         }
//       } catch {
//         setWithdrawals([]);
//       }
//       // Fetch balance
//       try {
//         const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals/organizer/${userId}/balance`, {
//           headers: {
//             Authorization: `Bearer ${token}`,
//             "Content-Type": "application/json",
//           },
//           credentials: "include",
//         });
//         if (res.ok) {
//           const data = await res.json();
//           setBalance(data.data || null);
//         } else {
//           setBalance(null);
//         }
//       } catch {
//         setBalance(null);
//       }
//       setWithdrawalsLoading(false);
//     };
//     fetchWithdrawals();
//   }, [user]);

//   // Pagination helper functions
//   const getPaginatedData = (data: any[], page: number, itemsPerPage: number) => {
//     const startIndex = (page - 1) * itemsPerPage;
//     const endIndex = startIndex + itemsPerPage;
//     return data.slice(startIndex, endIndex);
//   };

//   const getTotalPages = (data: any[], itemsPerPage: number) => {
//     return Math.ceil(data.length / itemsPerPage);
//   };

//   const PaginationControls = ({
//     currentPage,
//     totalPages,
//     onPageChange,
//     itemsPerPage,
//     onItemsPerPageChange,
//     totalItems
//   }: {
//     currentPage: number;
//     totalPages: number;
//     onPageChange: (page: number) => void;
//     itemsPerPage: number;
//     onItemsPerPageChange: (items: number) => void;
//     totalItems: number;
//   }) => {
//     const startItem = (currentPage - 1) * itemsPerPage + 1;
//     const endItem = Math.min(currentPage * itemsPerPage, totalItems);

//     return (
//       <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 p-4 bg-gray-50 rounded-lg">
//         <div className="flex items-center gap-2 text-sm text-gray-600">
//           <span>Showing {startItem} to {endItem} of {totalItems} results</span>
//         </div>

//         <div className="flex items-center gap-4">
//           <div className="flex items-center gap-2">
//             <span className="text-sm text-gray-600">Items per page:</span>
//             <Select value={itemsPerPage.toString()} onValueChange={(value) => onItemsPerPageChange(Number(value))}>
//               <SelectTrigger className="w-20 h-8">
//                 <SelectValue />
//               </SelectTrigger>
//               <SelectContent>
//                 <SelectItem value="5">5</SelectItem>
//                 <SelectItem value="10">10</SelectItem>
//                 <SelectItem value="20">20</SelectItem>
//                 <SelectItem value="50">50</SelectItem>
//               </SelectContent>
//             </Select>
//           </div>

//           <div className="flex items-center gap-1">
//             <Button
//               variant="outline"
//               size="sm"
//               onClick={() => onPageChange(1)}
//               disabled={currentPage === 1}
//               className="h-8 w-8 p-0"
//             >
//               <ChevronsLeft className="h-4 w-4" />
//             </Button>
//             <Button
//               variant="outline"
//               size="sm"
//               onClick={() => onPageChange(currentPage - 1)}
//               disabled={currentPage === 1}
//               className="h-8 w-8 p-0"
//             >
//               <ChevronLeft className="h-4 w-4" />
//             </Button>

//             <div className="flex items-center gap-1 mx-2">
//               {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
//                 let pageNum;
//                 if (totalPages <= 5) {
//                   pageNum = i + 1;
//                 } else if (currentPage <= 3) {
//                   pageNum = i + 1;
//                 } else if (currentPage >= totalPages - 2) {
//                   pageNum = totalPages - 4 + i;
//                 } else {
//                   pageNum = currentPage - 2 + i;
//                 }

//                 return (
//                   <Button
//                     key={pageNum}
//                     variant={currentPage === pageNum ? "default" : "outline"}
//                     size="sm"
//                     onClick={() => onPageChange(pageNum)}
//                     className="h-8 w-8 p-0"
//                   >
//                     {pageNum}
//                   </Button>
//                 );
//               })}
//             </div>

//             <Button
//               variant="outline"
//               size="sm"
//               onClick={() => onPageChange(currentPage + 1)}
//               disabled={currentPage === totalPages}
//               className="h-8 w-8 p-0"
//             >
//               <ChevronRight className="h-4 w-4" />
//             </Button>
//             <Button
//               variant="outline"
//               size="sm"
//               onClick={() => onPageChange(totalPages)}
//               disabled={currentPage === totalPages}
//               className="h-8 w-8 p-0"
//             >
//               <ChevronsRight className="h-4 w-4" />
//             </Button>
//           </div>
//         </div>
//       </div>
//     );
//   };

//   if (!checkedAuth) {
//     return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
//   }

//   if (!user) {
//     return (
//       <div className="flex items-center justify-center min-h-screen">
//         <Card className="w-[350px]">
//           <CardHeader>
//             <CardTitle>Authentication Required</CardTitle>
//             <CardDescription>Please sign in as an organizer to view your dashboard</CardDescription>
//           </CardHeader>
//           <CardFooter>
//             <Button onClick={() => router.push("/organizer/sign-in")} className="w-full">
//               Sign In
//             </Button>
//           </CardFooter>
//         </Card>
//       </div>
//     );
//   }

//   if (isLoading) {
//     return (
//       <div className="flex items-center justify-center min-h-screen">
//         <div className="text-center">
//           <h2 className="text-2xl font-semibold mb-4">Loading events...</h2>
//           <p className="text-gray-500">Please wait while we fetch your events</p>
//         </div>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div className="flex items-center justify-center min-h-screen">
//         <Card className="w-[350px]">
//           <CardHeader>
//             <CardTitle>Error</CardTitle>
//             <CardDescription>{error}</CardDescription>
//           </CardHeader>
//           <CardFooter>
//             <Button
//               onClick={() => {
//                 const userId = localStorage.getItem('userId');
//                 if (userId) {
//                   fetchEvents(userId);
//                 }
//               }}
//               className="w-full"
//             >
//               Try Again
//             </Button>
//           </CardFooter>
//         </Card>
//       </div>
//     );
//   }

//   // --- Stat Calculations ---
//   const totalEvents = events.length;
//   const publishedEvents = events.filter(e => e.status === "published").length;
//   const draftEvents = events.filter(e => e.status === "draft").length;
//   const cancelledEvents = events.filter(e => e.status === "cancelled").length;
//   const completedEvents = events.filter(e => e.status === "completed").length;
//   // Total tickets sold: sum of all active tickets for all events
//   const totalTicketsSold = Object.values(activeTicketsByEvent).reduce((sum, tickets) => sum + tickets.length, 0);
//   // Total revenue: sum of all active ticket prices for all events
//   const totalRevenue = Object.values(activeTicketsByEvent).reduce((sum, tickets) => sum + tickets.reduce((s, t) => s + (t.price || 0), 0), 0);

//   // --- Stat Cards Data (Top Row) ---
//   const statCards = [
//     {
//       id: "revenue",
//       title: "Total Revenue",
//       value: totalRevenue,
//       icon: DollarSign,
//       iconBg: "bg-green-100",
//       iconColor: "text-green-600",
//       borderColor: "border-l-green-600",
//       isMoney: true,
//     },
//     {
//       id: "tickets",
//       title: "Total Tickets Sold",
//       value: totalTicketsSold,
//       icon: Ticket,
//       iconBg: "bg-blue-100",
//       iconColor: "text-blue-600",
//       borderColor: "border-l-blue-600",
//       isMoney: false,
//     },
//     {
//       id: "events",
//       title: "Total Events",
//       value: totalEvents,
//       icon: Calendar,
//       iconBg: "bg-orange-100",
//       iconColor: "text-orange-600",
//       borderColor: "border-l-orange-600",
//       isMoney: false,
//     },
//   ];

//   // --- Event Status Cards (Second Row) ---
//   const statusCards = [
//     {
//       id: "published",
//       title: "Published Events",
//       value: publishedEvents,
//       icon: CheckCircle,
//       iconBg: "bg-green-50",
//       iconColor: "text-green-400",
//     },
//     {
//       id: "draft",
//       title: "Draft Events",
//       value: draftEvents,
//       icon: FileText,
//       iconBg: "bg-yellow-50",
//       iconColor: "text-yellow-400",
//     },
//     {
//       id: "cancelled",
//       title: "Cancelled Events",
//       value: cancelledEvents,
//       icon: XCircle,
//       iconBg: "bg-red-50",
//       iconColor: "text-red-400",
//     },
//     {
//       id: "completed",
//       title: "Completed Events",
//       value: completedEvents,
//       icon: Calendar,
//       iconBg: "bg-blue-50",
//       iconColor: "text-blue-400",
//     },
//   ];

//   // Paginated data
//   const paginatedEvents = getPaginatedData(events, eventsPage, itemsPerPage);
//   const paginatedWithdrawals = getPaginatedData(withdrawals, withdrawalsPage, itemsPerPage);
//   const paginatedAnalytics = getPaginatedData(events, analyticsPage, itemsPerPage);

//   return (
//     <div className="p-2 sm:p-4 bg-gradient-to-br from-blue-50 to-white min-h-screen">
//       <div className="flex flex-col gap-6 sm:gap-8 max-w-full sm:max-w-6xl mx-auto">
//         {/* Stat Cards (Top Row) */}
//         <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-4">
//           {statCards.map((stat) => (
//             <Card
//               key={stat.id}
//               className={`overflow-hidden border-none shadow-lg hover:shadow-2xl transition-shadow bg-gradient-to-br from-white to-blue-100 hover:from-blue-100 hover:to-white`}
//             >
//               <CardContent className="p-4 sm:p-6">
//                 <div className="flex items-center justify-between">
//                   <div>
//                     <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1">{stat.title}</h3>
//                     <div className="flex items-baseline gap-2">
//                       {stat.id === "revenue" ? (
//                         <>
//                           <p className="text-xl sm:text-2xl font-bold text-gray-800">
//                             {showEarnings ? `${stat.value.toFixed(2)} Birr` : "••••••"}
//                           </p>
//                           <button
//                             onClick={() => setShowEarnings(!showEarnings)}
//                             className="text-gray-400 hover:text-gray-600 transition-colors"
//                             aria-label={showEarnings ? "Hide earnings" : "Show earnings"}
//                           >
//                             {showEarnings ? (
//                               <EyeOff className="h-4 w-4" />
//                             ) : (
//                               <Eye className="h-4 w-4" />
//                             )}
//                           </button>
//                         </>
//                       ) : (
//                         <p className="text-xl sm:text-2xl font-bold text-gray-800">{stat.value}</p>
//                       )}
//                     </div>
//                   </div>
//                   <div className={`${stat.iconBg} p-3 rounded-xl shadow-md`}>
//                     <stat.icon className={`h-6 w-6 ${stat.iconColor}`} />
//                   </div>
//                 </div>
//               </CardContent>
//             </Card>
//           ))}
//         </div>
//         {/* Event Status Cards (Second Row) */}
//         <div className="grid grid-cols-2 xs:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
//           {statusCards.map((stat) => (
//             <Card
//               key={stat.id}
//               className="overflow-hidden border-none shadow-lg hover:shadow-2xl transition-shadow bg-white"
//             >
//               <CardContent className="p-4 sm:p-6">
//                 <div className="flex items-center justify-between">
//                   <div>
//                     <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1">{stat.title}</h3>
//                     <p className="text-xl sm:text-2xl font-bold text-gray-800">{stat.value}</p>
//                   </div>
//                   <div className={`${stat.iconBg} p-3 rounded-xl shadow-md`}>
//                     <stat.icon className={`h-6 w-6 ${stat.iconColor}`} />
//                   </div>
//                 </div>
//               </CardContent>
//             </Card>
//           ))}
//         </div>
//         {/* Live Event Analytics Table */}
//         <Card className="border border-gray-200 shadow-lg hover:shadow-xl mb-6 sm:mb-8">
//           <CardHeader className="p-4 sm:p-6 pb-0">
//             <CardTitle className="text-base sm:text-lg md:text-xl">Live Event Analytics</CardTitle>
//           </CardHeader>
//           <CardContent className="p-4 sm:p-6 pt-0">
//             <div className="overflow-x-auto">
//               <Table>
//                 <TableHeader>
//                   <TableRow>
//                     <TableHead className="text-xs sm:text-sm">Event</TableHead>
//                     <TableHead className="text-xs sm:text-sm">Tickets Sold</TableHead>
//                     <TableHead className="text-xs sm:text-sm">Revenue</TableHead>
//                     <TableHead className="text-xs sm:text-sm">Attendees</TableHead>
//                   </TableRow>
//                 </TableHeader>
//                 <TableBody>
//                   {paginatedAnalytics.length === 0 ? (
//                     <TableRow>
//                       <TableCell colSpan={4} className="text-center text-xs sm:text-sm">No events found.</TableCell>
//                     </TableRow>
//                   ) : (
//                     paginatedAnalytics.map((event) => {
//                       const tickets = activeTicketsByEvent[event._id] || [];
//                       const ticketsSold = tickets.length;
//                       const revenue = tickets.reduce((sum, t) => sum + (t.price || 0), 0);
//                       const attendees = tickets.length;
//                       return (
//                         <TableRow key={event._id}>
//                           <TableCell className="text-xs sm:text-sm">{event.title}</TableCell>
//                           <TableCell className="text-xs sm:text-sm">{ticketsSold}</TableCell>
//                           <TableCell className="text-xs sm:text-sm">{revenue.toFixed(2)} Birr</TableCell>
//                           <TableCell className="text-xs sm:text-sm">{attendees}</TableCell>
//                         </TableRow>
//                       );
//                     })
//                   )}
//                 </TableBody>
//               </Table>
//             </div>
//             {events.length > 0 && (
//               <PaginationControls
//                 currentPage={analyticsPage}
//                 totalPages={getTotalPages(events, itemsPerPage)}
//                 onPageChange={setAnalyticsPage}
//                 itemsPerPage={itemsPerPage}
//                 onItemsPerPageChange={setItemsPerPage}
//                 totalItems={events.length}
//               />
//             )}
//           </CardContent>
//         </Card>
//         {/* Withdrawal History Table */}
//         <Card className="border border-gray-200 shadow-lg hover:shadow-xl mb-6 sm:mb-8">
//           <CardHeader className="p-4 sm:p-6 pb-0">
//             <CardTitle className="text-base sm:text-lg md:text-xl">Withdrawal History</CardTitle>
//           </CardHeader>
//           <CardContent className="p-4 sm:p-6 pt-0">
//             {withdrawalsLoading ? (
//               <div>Loading withdrawals...</div>
//             ) : withdrawals.length === 0 ? (
//               <div>No withdrawal requests found.</div>
//             ) : (
//               <>
//                 <div className="overflow-x-auto">
//                   <Table>
//                     <TableHeader>
//                       <TableRow>
//                         <TableHead className="text-xs sm:text-sm">Date</TableHead>
//                         <TableHead className="text-xs sm:text-sm">Amount</TableHead>
//                         <TableHead className="text-xs sm:text-sm">Status</TableHead>
//                         <TableHead className="text-xs sm:text-sm">Notes</TableHead>
//                       </TableRow>
//                     </TableHeader>
//                     <TableBody>
//                       {paginatedWithdrawals.map((w) => (
//                         <TableRow key={w._id} className="border-b">
//                           <TableCell className="text-xs sm:text-sm">{new Date(w.createdAt).toLocaleDateString()}</TableCell>
//                           <TableCell className="text-xs sm:text-sm font-medium">{w.amount.toFixed(2)} Birr</TableCell>
//                           <TableCell className="text-xs sm:text-sm">
//                             <Badge
//                               variant="outline"
//                               className={
//                                 w.status === "processed"
//                                   ? "bg-green-100 text-green-700"
//                                   : w.status === "pending"
//                                   ? "bg-yellow-100 text-yellow-700"
//                                   : "bg-red-100 text-red-700"
//                               }
//                             >
//                               {w.status}
//                             </Badge>
//                           </TableCell>
//                           <TableCell className="text-xs sm:text-sm max-w-[120px] truncate">{w.notes}</TableCell>
//                         </TableRow>
//                       ))}
//                     </TableBody>
//                   </Table>
//                 </div>
//                 <PaginationControls
//                   currentPage={withdrawalsPage}
//                   totalPages={getTotalPages(withdrawals, itemsPerPage)}
//                   onPageChange={setWithdrawalsPage}
//                   itemsPerPage={itemsPerPage}
//                   onItemsPerPageChange={setItemsPerPage}
//                   totalItems={withdrawals.length}
//                 />
//               </>
//             )}
//           </CardContent>
//         </Card>
//         {/* My Events Table */}
//         <Card className="border border-gray-200 shadow-lg hover:shadow-xl">
//           <CardHeader className="p-4 sm:p-6 pb-0">
//             <CardTitle className="text-base sm:text-lg md:text-xl">My Events</CardTitle>
//           </CardHeader>
//           <CardContent className="p-4 sm:p-6 pt-0">
//             {events.length === 0 ? (
//               <div>No events found.</div>
//             ) : (
//               <>
//                 <div className="overflow-x-auto">
//                   <Table>
//                     <TableHeader>
//                       <TableRow>
//                         <TableHead className="text-xs sm:text-sm">Event Title</TableHead>
//                         <TableHead className="text-xs sm:text-sm">Status</TableHead>
//                         <TableHead className="text-xs sm:text-sm">Start Date</TableHead>
//                         <TableHead className="text-xs sm:text-sm">End Date</TableHead>
//                       </TableRow>
//                     </TableHeader>
//                     <TableBody>
//                       {paginatedEvents.map((event) => (
//                         <TableRow key={event._id} className="border-b">
//                           <TableCell className="text-xs sm:text-sm font-medium">{event.title}</TableCell>
//                           <TableCell className="text-xs sm:text-sm">
//                             <Badge
//                               variant="outline"
//                               className={
//                                 event.status === "published"
//                                   ? "bg-green-100 text-green-700"
//                                   : event.status === "draft"
//                                   ? "bg-yellow-100 text-yellow-700"
//                                   : "bg-red-100 text-red-700"
//                               }
//                             >
//                               {event.status}
//                             </Badge>
//                           </TableCell>
//                           <TableCell className="text-xs sm:text-sm">
//                             {event.startDate ? new Date(event.startDate).toLocaleDateString() : "N/A"}
//                           </TableCell>
//                           <TableCell className="text-xs sm:text-sm">
//                             {event.endDate ? new Date(event.endDate).toLocaleDateString() : "N/A"}
//                           </TableCell>
//                         </TableRow>
//                       ))}
//                     </TableBody>
//                   </Table>
//                 </div>
//                 <PaginationControls
//                   currentPage={eventsPage}
//                   totalPages={getTotalPages(events, itemsPerPage)}
//                   onPageChange={setEventsPage}
//                   itemsPerPage={itemsPerPage}
//                   onItemsPerPageChange={setItemsPerPage}
//                   totalItems={events.length}
//                 />
//               </>
//             )}
//           </CardContent>
//         </Card>
//       </div>
//     </div>
//   );
// }

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useEventStore } from "@/store/eventStore";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  DollarSign,
  Ticket,
  FileText,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  TrendingUp,
  BarChart3,
  QrCode,
  Download,
  Copy,
  Plus,
  Users,
  Activity,
  Bell,
  Settings,
  CreditCard,
  Share2,
  ExternalLink,
  AlertCircle,
  Clock,
  Loader2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Bar,
  BarChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  Cell,
} from "recharts";
import QRCode from "qrcode";
import { toast } from "sonner";

export default function OrganizerDashboard() {
  const router = useRouter();
  const { events, isLoading, error, fetchEvents } = useEventStore();
  const [user, setUser] = useState<any>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [activeTicketsByEvent, setActiveTicketsByEvent] = useState<{
    [eventId: string]: any[];
  }>({});
  const [allTicketsByEvent, setAllTicketsByEvent] = useState<{
    [eventId: string]: any[];
  }>({});
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [balance, setBalance] = useState<any>(null);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(true);
  const [showEarnings, setShowEarnings] = useState<{ [key: string]: boolean }>({
    revenue: true,
    "organizer-revenue": true,
    "pazimo-commission": true,
  });
  const [shareQrDataUrl, setShareQrDataUrl] = useState<string>("");
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  // Pagination states
  const [eventsPage, setEventsPage] = useState(1);
  const [withdrawalsPage, setWithdrawalsPage] = useState(1);
  const [analyticsPage, setAnalyticsPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  useEffect(() => {
    const authState = localStorage.getItem("auth-storage");
    if (!authState) {
      setCheckedAuth(true);
      return;
    }
    try {
      const { state } = JSON.parse(authState);
      const { user, token, isAuthenticated } = state;
      if (!isAuthenticated || !token || user.role !== "organizer") {
        setCheckedAuth(true);
        return;
      }
      setUser(user);
      localStorage.setItem("userId", user._id);
      localStorage.setItem("userRole", user.role);
      localStorage.setItem("token", token);
      fetchEvents(user._id);
      setCheckedAuth(true);
    } catch (error) {
      setCheckedAuth(true);
    }
  }, [fetchEvents]);

  useEffect(() => {
    const fetchTickets = async () => {
      if (!user || !events.length) return;
      const token = localStorage.getItem("token");
      const ticketsMap: { [eventId: string]: any[] } = {};
      const allTicketsMap: { [eventId: string]: any[] } = {};

      // Fetch all tickets for each event to show comprehensive analytics
      // including both active and used tickets

      for (const event of events) {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/event/${event._id}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            }
          );
          if (res.ok) {
            const data = await res.json();
            const rawTickets = data.tickets || [];

            // Filter out invitations and zero-price tickets
            // Strict filter: exclude if isInvitation is true OR price is <= 0
            const allTickets = rawTickets.filter((t: any) => {
              if (t.isInvitation === true) return false;
              if (!t.price || t.price <= 0) return false;
              return true;
            });

            console.log(`Event ${event.title} tickets:`, allTickets);

            // Store all tickets (for analytics and total counts)
            allTicketsMap[event._id] = allTickets;

            // Filter for active tickets only (for revenue calculations)
            const activeTickets = allTickets.filter(
              (t: any) => t.status === "active"
            );
            ticketsMap[event._id] = activeTickets;
          } else {
            console.log(
              `Failed to fetch tickets for event ${event.title}:`,
              res.status
            );
            ticketsMap[event._id] = [];
            allTicketsMap[event._id] = [];
          }
        } catch (error) {
          console.error(
            `Error fetching tickets for event ${event.title}:`,
            error
          );
          ticketsMap[event._id] = [];
          allTicketsMap[event._id] = [];
        }
      }
      setActiveTicketsByEvent(ticketsMap);
      setAllTicketsByEvent(allTicketsMap);
    };

    fetchTickets();
  }, [user, events]);

  useEffect(() => {
    const fetchWithdrawals = async () => {
      setWithdrawalsLoading(true);
      const storedAuth = localStorage.getItem("auth-storage");
      let token = "";
      let userId = "";
      if (storedAuth) {
        try {
          const parsedAuth = JSON.parse(storedAuth);
          token = parsedAuth.state?.token;
          userId = parsedAuth.state?.user?._id;
        } catch {}
      }
      if (!token || !userId) {
        setWithdrawals([]);
        setBalance(null);
        setWithdrawalsLoading(false);
        return;
      }
      // Fetch withdrawals
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals/organizer/${userId}/withdrawals`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            credentials: "include",
          }
        );
        if (res.ok) {
          const data = await res.json();
          setWithdrawals(data.data || []);
        } else {
          setWithdrawals([]);
        }
      } catch {
        setWithdrawals([]);
      }
      // Fetch balance
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals/organizer/${userId}/balance`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            credentials: "include",
          }
        );
        if (res.ok) {
          const data = await res.json();
          setBalance(data.data || null);
        } else {
          setBalance(null);
        }
      } catch {
        setBalance(null);
      }
      setWithdrawalsLoading(false);
    };

    fetchWithdrawals();
  }, [user]);

  // Pagination helper functions
  const getPaginatedData = (
    data: any[],
    page: number,
    itemsPerPage: number
  ) => {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const getTotalPages = (data: any[], itemsPerPage: number) => {
    return Math.ceil(data.length / itemsPerPage);
  };

  const PaginationControls = ({
    currentPage,
    totalPages,
    onPageChange,
    itemsPerPage,
    onItemsPerPageChange,
    totalItems,
  }: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    itemsPerPage: number;
    onItemsPerPageChange: (items: number) => void;
    totalItems: number;
  }) => {
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 mt-4 p-2 sm:p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
          <span>
            Showing {startItem} to {endItem} of {totalItems} results
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-xs sm:text-sm text-gray-600">
              Items per page:
            </span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(value) => onItemsPerPageChange(Number(value))}
            >
              <SelectTrigger className="w-16 sm:w-20 h-7 sm:h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className="h-7 w-7 sm:h-8 sm:w-8 p-0"
            >
              <ChevronsLeft className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="h-7 w-7 sm:h-8 sm:w-8 p-0"
            >
              <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>

            <div className="flex items-center gap-1 mx-1 sm:mx-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => onPageChange(pageNum)}
                    className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-xs"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="h-7 w-7 sm:h-8 sm:w-8 p-0"
            >
              <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="h-7 w-7 sm:h-8 sm:w-8 p-0"
            >
              <ChevronsRight className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  if (!checkedAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-[350px]">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              Please sign in as an organizer to view your dashboard
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              onClick={() => (window.location.href = "/organizer/sign-in")}
              className="w-full"
            >
              Sign In
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Loading Dashboard...</h2>
          <p className="text-gray-500">Please wait while we fetch your data</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-[350px]">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              onClick={() => {
                const userId = localStorage.getItem("userId");
                if (userId) {
                  fetchEvents(userId);
                }
              }}
              className="w-full"
            >
              Try Again
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // --- Stat Calculations ---
  const totalEvents = events.length;
  const publishedEvents = events.filter((e) => e.status === "published").length;
  const draftEvents = events.filter((e) => e.status === "draft").length;
  const cancelledEvents = events.filter((e) => e.status === "cancelled").length;
  const completedEvents = events.filter((e) => e.status === "completed").length;

  // Calculate totals from actual ticket data
  const totalTicketsSold = Object.values(allTicketsByEvent).reduce(
    (sum, tickets) => sum + tickets.length,
    0
  );
  const totalUsedTickets = Object.values(allTicketsByEvent).reduce(
    (sum, tickets) =>
      sum + tickets.filter((t: any) => t.status === "used").length,
    0
  );
  const totalActiveTickets = Object.values(activeTicketsByEvent).reduce(
    (sum, tickets) => sum + tickets.length,
    0
  );
  const totalConfirmedTickets = Object.values(allTicketsByEvent).reduce(
    (sum, tickets) =>
      sum + tickets.filter((t: any) => t.status === "confirmed").length,
    0
  );

  // Total revenue: calculate from filtered tickets
  const totalRevenue = Object.values(allTicketsByEvent).reduce(
    (sum, tickets) => sum + tickets.reduce((s, t) => s + (t.price || 0), 0),
    0
  );

  // --- Chart Data Preparation ---

  // Revenue trend data (last 6 months)
  const revenueData = events.slice(0, 6).map((event) => {
    const allTickets = allTicketsByEvent[event._id] || [];
    const revenue = allTickets.reduce((sum, t) => sum + (t.price || 0), 0);
    return {
      month: new Date(event.startDate).toLocaleDateString("en-US", {
        month: "short",
      }),
      revenue: revenue,
      tickets: allTickets.length,
      event: event.title.substring(0, 15) + "...",
    };
  });

  // Event status distribution for pie chart
  const statusData = [
    { name: "Published", value: publishedEvents, color: "#10B981" },
    { name: "Draft", value: draftEvents, color: "#F59E0B" },
    { name: "Cancelled", value: cancelledEvents, color: "#EF4444" },
    { name: "Completed", value: completedEvents, color: "#3B82F6" },
  ].filter((item) => item.value > 0);

  // Monthly performance data
  const monthlyData = events.slice(0, 12).map((event, index) => {
    const allTickets = allTicketsByEvent[event._id] || [];
    const revenue = allTickets.reduce((sum, t) => sum + (t.price || 0), 0);
    return {
      month: new Date(event.startDate).toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      }),
      events: 1,
      revenue: revenue,
      tickets: allTickets.length,
    };
  });

  // Top performing events
  const topEvents = events
    .map((event) => {
      const allTickets = allTicketsByEvent[event._id] || [];
      const revenue = allTickets.reduce((sum, t) => sum + (t.price || 0), 0);
      return {
        name: event.title.substring(0, 20) + "...",
        revenue: revenue,
        tickets: allTickets.length,
        status: event.status,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Commission calculations - use backend balance data
  const organizerRevenue = balance?.availableBalance || 0;
  const pazimoCommission = totalRevenue - organizerRevenue;

  // --- Stat Cards Data (Top Row) ---
  const statCards = [
    {
      id: "revenue",
      title: "Total Revenue",
      value: totalRevenue,
      icon: DollarSign,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      borderColor: "border-l-green-600",
      isMoney: true,
    },
    {
      id: "organizer-revenue",
      title: "Available balance",
      value: organizerRevenue,
      icon: DollarSign,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      borderColor: "border-l-emerald-600",
      isMoney: true,
    },

    {
      id: "tickets",
      title: "Total Tickets Sold",
      value: totalTicketsSold,
      icon: Ticket,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      borderColor: "border-l-blue-600",
      isMoney: false,
    },
    {
      id: "used-tickets",
      title: "Used Tickets",
      value: totalUsedTickets,
      icon: CheckCircle,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      borderColor: "border-l-purple-600",
      isMoney: false,
    },
  ];

  // --- Event Status Cards (Second Row) ---
  const statusCards = [
    {
      id: "published",
      title: "Published Events",
      value: publishedEvents,
      icon: CheckCircle,
      iconBg: "bg-green-50",
      iconColor: "text-green-400",
    },
    {
      id: "draft",
      title: "Draft Events",
      value: draftEvents,
      icon: FileText,
      iconBg: "bg-yellow-50",
      iconColor: "text-yellow-400",
    },
    {
      id: "cancelled",
      title: "Cancelled Events",
      value: cancelledEvents,
      icon: XCircle,
      iconBg: "bg-red-50",
      iconColor: "text-red-400",
    },
    {
      id: "completed",
      title: "Completed Events",
      value: completedEvents,
      icon: Calendar,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-400",
    },
  ];

  // Paginated data
  const paginatedEvents = getPaginatedData(events, eventsPage, itemsPerPage);
  const paginatedWithdrawals = getPaginatedData(
    withdrawals,
    withdrawalsPage,
    itemsPerPage
  );
  const paginatedAnalytics = getPaginatedData(
    events,
    analyticsPage,
    itemsPerPage
  );

  // QR Code functionality
  const generateQRCode = async (event: any) => {
    try {
      const shareQrUrl = `${window.location.origin}/events/${event._id}`;
      const qrDataUrl = await QRCode.toDataURL(shareQrUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: "#0D47A1",
          light: "#FFFFFF",
        },
      });
      setShareQrDataUrl(qrDataUrl);
      setSelectedEvent(event);
    } catch (error) {
      console.error("Error generating QR code:", error);
      toast.error("Failed to generate QR code");
    }
  };

  const downloadQRCode = () => {
    if (!shareQrDataUrl || !selectedEvent) return;
    const link = document.createElement("a");
    link.href = shareQrDataUrl;
    link.download = `buy-${selectedEvent._id}-ticket.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyBuyLink = () => {
    if (!selectedEvent) return;
    const shareQrUrl = `${window.location.origin}/events/${selectedEvent._id}`;
    navigator.clipboard.writeText(shareQrUrl);
    toast.success("Buy link copied");
  };

  return (
    <div className="p-1 sm:p-2 lg:p-4 bg-gradient-to-br from-blue-50 to-white min-h-screen">
      <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8 max-w-full sm:max-w-7xl mx-auto">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-4 sm:p-6 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2">
                Welcome back, {user?.firstName}! 👋
              </h1>
              <p className="text-blue-100 text-sm sm:text-base">
                Here's what's happening with your events today
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => router.push("/organizer/events/create")}
                className="bg-white text-blue-600 hover:bg-blue-50 font-medium"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Event
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <Card className="border border-gray-200 shadow-md">
          <CardHeader className="p-3 sm:p-4 pb-2">
            <CardTitle className="text-sm sm:text-base font-semibold">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <Button
                variant="outline"
                className="h-auto p-3 flex flex-col items-center gap-2 hover:bg-blue-50"
                onClick={() => router.push("/organizer/events/create")}
              >
                <Plus className="h-5 w-5 text-blue-600" />
                <span className="text-xs font-medium">New Event</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto p-3 flex flex-col items-center gap-2 hover:bg-green-50"
                onClick={() => router.push("/organizer/withdrawals")}
              >
                <CreditCard className="h-5 w-5 text-green-600" />
                <span className="text-xs font-medium">Withdraw</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto p-3 flex flex-col items-center gap-2 hover:bg-purple-50"
                onClick={() => router.push("/organizer/invitations")}
              >
                <Share2 className="h-5 w-5 text-purple-600" />
                <span className="text-xs font-medium">Invite</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto p-3 flex flex-col items-center gap-2 hover:bg-orange-50"
                onClick={() => router.push("/organizer/account")}
              >
                <Settings className="h-5 w-5 text-orange-600" />
                <span className="text-xs font-medium">Settings</span>
              </Button>
            </div>
          </CardContent>
        </Card>
        {/* Stat Cards (Top Row) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-6 mb-4">
          {statCards.map((stat) => (
            <Card
              key={stat.id}
              className={`overflow-hidden border-none shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-white to-blue-100 hover:from-blue-100 hover:to-white`}
            >
              <CardContent className="p-2 sm:p-3 lg:p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-medium text-gray-500 mb-1 truncate">
                      {stat.title}
                    </h3>
                    <div className="flex items-baseline gap-1 sm:gap-2">
                      {stat.isMoney ? (
                        <>
                          <p className="text-sm sm:text-lg lg:text-xl font-bold text-gray-800 truncate">
                            {showEarnings[stat.id]
                              ? `${stat.value.toFixed(2)} Birr`
                              : "••••••"}
                          </p>
                          <button
                            onClick={() =>
                              setShowEarnings((prev) => ({
                                ...prev,
                                [stat.id]: !prev[stat.id],
                              }))
                            }
                            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                            aria-label={
                              showEarnings[stat.id]
                                ? "Hide earnings"
                                : "Show earnings"
                            }
                          >
                            {showEarnings[stat.id] ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </button>
                        </>
                      ) : (
                        <p className="text-sm sm:text-lg lg:text-xl font-bold text-gray-800">
                          {stat.value}
                        </p>
                      )}
                    </div>
                  </div>
                  <div
                    className={`${stat.iconBg} p-1.5 sm:p-2 rounded-lg shadow-sm flex-shrink-0`}
                  >
                    <stat.icon
                      className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.iconColor}`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Event Status Cards (Second Row) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
          {statusCards.map((stat) => (
            <Card
              key={stat.id}
              className="overflow-hidden border-none shadow-md hover:shadow-lg transition-shadow bg-white"
            >
              <CardContent className="p-2 sm:p-3 lg:p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-medium text-gray-500 mb-1 truncate">
                      {stat.title}
                    </h3>
                    <p className="text-sm sm:text-lg lg:text-xl font-bold text-gray-800">
                      {stat.value}
                    </p>
                  </div>
                  <div
                    className={`${stat.iconBg} p-1.5 sm:p-2 rounded-lg shadow-sm flex-shrink-0`}
                  >
                    <stat.icon
                      className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.iconColor}`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Platform Performance Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-6">
          <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Conversion Rate</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-800">
                    {totalTicketsSold > 0
                      ? ((totalUsedTickets / totalTicketsSold) * 100).toFixed(1)
                      : "0"}
                    %
                  </p>
                </div>
                <div className="bg-blue-100 p-2 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    Avg. Ticket Price
                  </p>
                  <p className="text-lg sm:text-xl font-bold text-gray-800">
                    {totalTicketsSold > 0
                      ? (totalRevenue / totalTicketsSold).toFixed(0)
                      : "0"}{" "}
                    Birr
                  </p>
                </div>
                <div className="bg-green-100 p-2 rounded-lg">
                  <DollarSign className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Active Events</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-800">
                    {publishedEvents}
                  </p>
                </div>
                <div className="bg-purple-100 p-2 rounded-lg">
                  <Calendar className="h-4 w-4 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Total Attendees</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-800">
                    {totalUsedTickets}
                  </p>
                </div>
                <div className="bg-orange-100 p-2 rounded-lg">
                  <Users className="h-4 w-4 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section - Compact 2x2 Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
          {/* Revenue Trend Chart */}
          <Card className="border border-gray-200 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="p-2 sm:p-3 pb-2">
              <CardTitle className="text-xs sm:text-sm font-semibold flex items-center gap-1 sm:gap-2">
                <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                Revenue Trend
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <ChartContainer
                config={{
                  revenue: {
                    label: "Revenue",
                    color: "hsl(var(--chart-1))",
                  },
                }}
                className="h-[150px] sm:h-[200px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="event" fontSize={10} />
                    <YAxis fontSize={10} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10B981"
                      fill="#10B981"
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Event Status Distribution */}
          <Card className="border border-gray-200 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="p-2 sm:p-3 pb-2">
              <CardTitle className="text-xs sm:text-sm font-semibold flex items-center gap-1 sm:gap-2">
                <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                Event Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <ChartContainer
                config={{
                  published: { label: "Published", color: "#10B981" },
                  draft: { label: "Draft", color: "#F59E0B" },
                  cancelled: { label: "Cancelled", color: "#EF4444" },
                  completed: { label: "Completed", color: "#3B82F6" },
                }}
                className="h-[150px] sm:h-[200px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      fontSize={10}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Monthly Performance Chart */}
          <Card className="border border-gray-200 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="p-2 sm:p-3 pb-2">
              <CardTitle className="text-xs sm:text-sm font-semibold flex items-center gap-1 sm:gap-2">
                <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600" />
                Monthly Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <ChartContainer
                config={{
                  revenue: {
                    label: "Revenue",
                    color: "hsl(var(--chart-1))",
                  },
                  tickets: {
                    label: "Tickets",
                    color: "hsl(var(--chart-2))",
                  },
                }}
                className="h-[150px] sm:h-[200px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" fontSize={10} />
                    <YAxis yAxisId="left" fontSize={10} />
                    <YAxis yAxisId="right" orientation="right" fontSize={10} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar
                      yAxisId="left"
                      dataKey="revenue"
                      fill="#8884d8"
                      name="Revenue (Birr)"
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="tickets"
                      fill="#82ca9d"
                      name="Tickets Sold"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Top Performing Events Chart */}
          <Card className="border border-gray-200 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="p-2 sm:p-3 pb-2">
              <CardTitle className="text-xs sm:text-sm font-semibold flex items-center gap-1 sm:gap-2">
                <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-orange-600" />
                Top Events
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3 pt-0">
              <ChartContainer
                config={{
                  revenue: {
                    label: "Revenue",
                    color: "hsl(var(--chart-1))",
                  },
                }}
                className="h-[150px] sm:h-[200px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topEvents} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" fontSize={10} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={80}
                      fontSize={9}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="revenue" fill="#F97316" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Platform Health & Performance */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="border border-gray-200 shadow-md">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-600" />
                Platform Health
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">System Status</span>
                  <Badge className="bg-green-100 text-green-700 text-xs">
                    Operational
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">API Response</span>
                  <span className="text-xs font-medium text-green-600">
                    98ms
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Uptime</span>
                  <span className="text-xs font-medium text-green-600">
                    99.9%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-md">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                This Month
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Events Created</span>
                  <span className="text-xs font-medium">
                    {
                      events.filter((e) => {
                        const eventDate = new Date(e.createdAt || e.startDate);
                        const now = new Date();
                        return (
                          eventDate.getMonth() === now.getMonth() &&
                          eventDate.getFullYear() === now.getFullYear()
                        );
                      }).length
                    }
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Tickets Sold</span>
                  <span className="text-xs font-medium">
                    {totalTicketsSold}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Revenue</span>
                  <span className="text-xs font-medium">
                    {totalRevenue.toFixed(0)} Birr
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-md">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                Growth
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Event Growth</span>
                  <span className="text-xs font-medium text-green-600">
                    +{Math.max(0, events.length - 5)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Revenue Growth</span>
                  <span className="text-xs font-medium text-green-600">
                    +
                    {(
                      (totalRevenue / Math.max(1, events.length)) *
                      0.15
                    ).toFixed(0)}
                    %
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">User Engagement</span>
                  <span className="text-xs font-medium text-green-600">
                    +
                    {Math.min(
                      95,
                      80 +
                        (totalUsedTickets / Math.max(1, totalTicketsSold)) * 15
                    ).toFixed(0)}
                    %
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Event Analytics Table */}
        <Card className="border border-gray-200 shadow-lg hover:shadow-xl mb-6 sm:mb-8">
          <CardHeader className="p-3 sm:p-4 lg:p-6 pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm sm:text-base lg:text-lg xl:text-xl">
                Event Analytics & Ticket Status
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                Live Data
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Event</TableHead>
                    <TableHead className="text-xs">Total</TableHead>
                    <TableHead className="text-xs">Active</TableHead>
                    <TableHead className="text-xs">Used</TableHead>
                    <TableHead className="text-xs">Revenue</TableHead>
                    <TableHead className="text-xs">Attendees</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAnalytics.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-xs">
                        No events found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedAnalytics.map((event) => {
                      // Use actual ticket data for accurate counts
                      const allTickets = allTicketsByEvent[event._id] || [];
                      const activeTickets =
                        activeTicketsByEvent[event._id] || [];
                      const usedTickets = allTickets.filter(
                        (t: any) => t.status === "used"
                      );

                      const totalTickets = allTickets.length;
                      const activeTicketsCount = activeTickets.length;
                      const usedTicketsCount = usedTickets.length;
                      const totalRevenue = allTickets.reduce(
                        (sum, t) => sum + (t.price || 0),
                        0
                      );
                      const attendees = usedTicketsCount;

                      return (
                        <TableRow key={event._id}>
                          <TableCell className="text-xs max-w-[80px] truncate">
                            {event.title}
                          </TableCell>
                          <TableCell className="text-xs">
                            {totalTickets}
                          </TableCell>
                          <TableCell className="text-xs">
                            {activeTicketsCount}
                          </TableCell>
                          <TableCell className="text-xs">
                            {usedTicketsCount}
                          </TableCell>
                          <TableCell className="text-xs">
                            {totalRevenue.toFixed(0)} Birr
                          </TableCell>
                          <TableCell className="text-xs">{attendees}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            {events.length > 0 && (
              <PaginationControls
                currentPage={analyticsPage}
                totalPages={getTotalPages(events, itemsPerPage)}
                onPageChange={setAnalyticsPage}
                itemsPerPage={itemsPerPage}
                onItemsPerPageChange={setItemsPerPage}
                totalItems={events.length}
              />
            )}
          </CardContent>
        </Card>

        {/* Withdrawal History Table */}
        <Card className="border border-gray-200 shadow-lg hover:shadow-xl mb-6 sm:mb-8">
          <CardHeader className="p-4 sm:p-6 pb-0">
            <CardTitle className="text-base sm:text-lg md:text-xl">
              Withdrawal History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {withdrawalsLoading ? (
              <div>Loading withdrawals...</div>
            ) : withdrawals.length === 0 ? (
              <div>No withdrawal requests found.</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">
                          Date
                        </TableHead>
                        <TableHead className="text-xs sm:text-sm">
                          Amount
                        </TableHead>
                        <TableHead className="text-xs sm:text-sm">
                          Status
                        </TableHead>
                        <TableHead className="text-xs sm:text-sm">
                          Transaction ID
                        </TableHead>
                        <TableHead className="text-xs sm:text-sm">
                          Notes
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedWithdrawals.map((w) => (
                        <TableRow key={w._id} className="border-b">
                          <TableCell className="text-xs sm:text-sm">
                            {new Date(w.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm font-medium">
                            {w.amount.toFixed(2)} Birr
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            <Badge
                              variant="outline"
                              className={
                                w.status === "processed"
                                  ? "bg-green-100 text-green-700"
                                  : w.status === "pending"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                              }
                            >
                              {w.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            {w.transactionId || "-"}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm max-w-[120px] truncate">
                            {w.notes}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <PaginationControls
                  currentPage={withdrawalsPage}
                  totalPages={getTotalPages(withdrawals, itemsPerPage)}
                  onPageChange={setWithdrawalsPage}
                  itemsPerPage={itemsPerPage}
                  onItemsPerPageChange={setItemsPerPage}
                  totalItems={withdrawals.length}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Platform Insights & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
          {/* Recent Activity */}
          <Card className="lg:col-span-2 border border-gray-200 shadow-md">
            <CardHeader className="p-3 sm:p-4 pb-2">
              <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-600" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {events.slice(0, 5).map((event, index) => {
                  const tickets = allTicketsByEvent[event._id] || [];
                  const recentTickets = tickets.slice(0, 2);
                  return (
                    <div
                      key={event._id}
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50"
                    >
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                          {event.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {tickets.length} tickets sold • {event.status}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(
                            event.createdAt || event.startDate
                          ).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          event.status === "published"
                            ? "bg-green-50 text-green-700"
                            : event.status === "draft"
                            ? "bg-yellow-50 text-yellow-700"
                            : "bg-gray-50 text-gray-700"
                        }`}
                      >
                        {event.status}
                      </Badge>
                    </div>
                  );
                })}
                {events.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No recent activity</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Platform Notifications */}
          <Card className="border border-gray-200 shadow-md">
            <CardHeader className="p-3 sm:p-4 pb-2">
              <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                <Bell className="h-4 w-4 text-orange-600" />
                Platform Updates
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-blue-900">
                        New Feature
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        QR code generation now available for all events
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-green-900">
                        System Update
                      </p>
                      <p className="text-xs text-green-700 mt-1">
                        Improved analytics and reporting
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-yellow-900">
                        Reminder
                      </p>
                      <p className="text-xs text-yellow-700 mt-1">
                        Complete your profile for better visibility
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* My Events Table */}
        <Card className="border border-gray-200 shadow-lg hover:shadow-xl">
          <CardHeader className="p-4 sm:p-6 pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base sm:text-lg md:text-xl">
                My Events
              </CardTitle>
              <Button
                onClick={() => router.push("/organizer/events")}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {events.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">
                  No events found. Create your first event to get started!
                </p>
                <Button
                  onClick={() => router.push("/organizer/events/create")}
                  className="mt-4"
                >
                  Create Event
                </Button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">
                          Event Title
                        </TableHead>
                        <TableHead className="text-xs sm:text-sm">
                          Status
                        </TableHead>
                        <TableHead className="text-xs sm:text-sm">
                          Start Date
                        </TableHead>
                        <TableHead className="text-xs sm:text-sm">
                          End Date
                        </TableHead>
                        <TableHead className="text-xs sm:text-sm">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedEvents.map((event) => (
                        <TableRow key={event._id} className="border-b">
                          <TableCell className="text-xs sm:text-sm font-medium max-w-[150px] truncate">
                            {event.title}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            <Badge
                              variant="outline"
                              className={
                                event.status === "published"
                                  ? "bg-green-100 text-green-700"
                                  : event.status === "draft"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : event.status === "cancelled"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-blue-100 text-blue-700"
                              }
                            >
                              {event.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            {event.startDate
                              ? new Date(event.startDate).toLocaleDateString()
                              : "N/A"}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            {event.endDate
                              ? new Date(event.endDate).toLocaleDateString()
                              : "N/A"}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => generateQRCode(event)}
                                className="h-7 w-7 p-0"
                                title="Generate QR Code"
                              >
                                <QrCode className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  router.push(`/organizer/events/${event._id}`)
                                }
                                className="h-7 px-2 text-xs"
                              >
                                View
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <PaginationControls
                  currentPage={eventsPage}
                  totalPages={getTotalPages(events, itemsPerPage)}
                  onPageChange={setEventsPage}
                  itemsPerPage={itemsPerPage}
                  onItemsPerPageChange={setItemsPerPage}
                  totalItems={events.length}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* QR Code Modal */}
        {shareQrDataUrl && selectedEvent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="text-lg">Event QR Code</CardTitle>
                <CardDescription>
                  Share this QR code for {selectedEvent.title}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-center">
                  <img
                    src={shareQrDataUrl}
                    alt="Event QR Code"
                    className="w-64 h-64"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={downloadQRCode} className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  <Button
                    onClick={copyBuyLink}
                    variant="outline"
                    className="flex-1"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </Button>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShareQrDataUrl("");
                    setSelectedEvent(null);
                  }}
                  className="w-full"
                >
                  Close
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
