"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Edit, Trash, CheckCircle, Clock } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import CustomCampaignModal from "./customCampaignModal";
import { Event } from "@/types/event";

interface Campaign {
  _id: string;
  title: string;
  message: string;
  status: "draft" | "active" | "completed" | "failed";
  recipients: any[];
  targetedEvents: any[];
  price: number;
  totalRecipients: number;
  createdAt: string;
}

export default function CampaignHistoryPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [viewCampaign, setViewCampaign] = useState<Campaign | null>(null);

  // We need events for the modal to map event IDs back to names if needed,
  // or just to populate the selector.
  const [events, setEvents] = useState<Event[]>([]);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/campaigns`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      const data = await res.json();
      if (data.success) {
        setCampaigns(data.data);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    // Re-fetching events here so modal works correctly
    try {
      const userId = localStorage.getItem("userId");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/organizer/${userId}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      const data = await res.json();
      setEvents(data.events || data.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    fetchEvents();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this draft?")) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/campaigns/${id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      if (res.ok) {
        setCampaigns((prev) => prev.filter((c) => c._id !== id));
        toast.success("Deleted");
      } else {
        toast.error("Could not delete");
      }
    } catch (e) {
      toast.error("Error deleting");
    }
  };

  const handleEdit = (campaign: Campaign) => {
    // Direct edit mostly for drafts
    if (campaign.status === "draft") {
      setEditingCampaign(campaign);
      setShowModal(true);
    }
  };

  const handleRowClick = (campaign: Campaign) => {
    if (campaign.status === "draft") {
      handleEdit(campaign);
    } else {
      setViewCampaign(campaign);
    }
  };

  if (loading)
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center h-24 text-gray-500"
                >
                  No campaigns found.
                </TableCell>
              </TableRow>
            ) : (
              campaigns.map((camp) => (
                <TableRow
                  key={camp._id}
                  className="cursor-pointer hover:bg-gray-50 from-gray-50"
                  onClick={() => handleRowClick(camp)}
                >
                  <TableCell className="font-medium">
                    {camp.title}
                    <div className="text-xs text-gray-500 truncate max-w-[200px]">
                      {camp.message}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        camp.status === "active"
                          ? "default"
                          : camp.status === "completed"
                            ? "secondary"
                            : "outline"
                      }
                      className={
                        camp.status === "active"
                          ? "bg-blue-100 text-blue-800 hover:bg-blue-100"
                          : camp.status === "completed"
                            ? "bg-green-100 text-green-800 hover:bg-green-100"
                            : camp.status === "draft"
                              ? "bg-gray-100 text-gray-800 hover:bg-gray-100"
                              : ""
                      }
                    >
                      {camp.status === "active"
                        ? "Sent"
                        : camp.status.charAt(0).toUpperCase() +
                          camp.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {camp.totalRecipients || camp.recipients?.length}
                  </TableCell>
                  <TableCell>
                    {new Date(camp.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {camp.status === "draft" && (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(camp);
                          }}
                        >
                          <Edit className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => handleDelete(camp._id, e)}
                        >
                          <Trash className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    )}
                    {camp.status === "active" && (
                      <Clock className="h-4 w-4 ml-auto text-blue-500" />
                    )}
                    {camp.status === "completed" && (
                      <CheckCircle className="h-4 w-4 ml-auto text-green-500" />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {showModal && (
        <CustomCampaignModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setEditingCampaign(null);
            fetchCampaigns(); // Refresh list after edit/send
          }}
          events={events}
          initialData={editingCampaign}
        />
      )}

      <Dialog
        open={!!viewCampaign}
        onOpenChange={(o) => !o && setViewCampaign(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Campaign Details</DialogTitle>
          </DialogHeader>
          {viewCampaign && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-gray-500">
                    Campaign Title
                  </h4>
                  <p className="font-semibold">{viewCampaign.title}</p>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-gray-500">
                    Sent Date
                  </h4>
                  <p>{new Date(viewCampaign.createdAt).toLocaleString()}</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-500">Message</h4>
                <div className="bg-gray-50 p-4 rounded-lg text-sm border">
                  {viewCampaign.message}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium text-gray-500">
                    Recipients (
                    {viewCampaign.totalRecipients ||
                      viewCampaign.recipients?.length ||
                      0}
                    )
                  </h4>
                </div>
                <div className="border rounded-md">
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">#</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Phone Number</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewCampaign.recipients?.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-gray-500">
                              {i + 1}
                            </TableCell>
                            <TableCell>{r.name || "N/A"}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {r.phone}
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!viewCampaign.recipients ||
                          viewCampaign.recipients.length === 0) && (
                          <TableRow>
                            <TableCell
                              colSpan={3}
                              className="text-center text-gray-500 py-4"
                            >
                              No recipient details available.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
