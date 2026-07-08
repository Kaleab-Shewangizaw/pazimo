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
      <div className="p-8 flex justify-center bg-white dark:bg-black">
        <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );

  return (
    <div className="space-y-4 bg-white dark:bg-black">
      <div className="bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-200 dark:border-gray-800">
              <TableHead className="dark:text-gray-300">Title</TableHead>
              <TableHead className="dark:text-gray-300">Status</TableHead>
              <TableHead className="dark:text-gray-300">Recipients</TableHead>
              <TableHead className="dark:text-gray-300">Created</TableHead>
              <TableHead className="text-right dark:text-gray-300">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center h-24 text-gray-500 dark:text-gray-400"
                >
                  No campaigns found.
                </TableCell>
              </TableRow>
            ) : (
              campaigns.map((camp) => (
                <TableRow
                  key={camp._id}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 border-gray-100 dark:border-gray-800"
                  onClick={() => handleRowClick(camp)}
                >
                  <TableCell className="font-medium dark:text-gray-100">
                    {camp.title}
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
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
                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                          : camp.status === "completed"
                            ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30"
                            : camp.status === "draft"
                              ? "bg-gray-100 dark:bg-gray-800/50 text-gray-800 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50"
                              : ""
                      }
                    >
                      {camp.status === "active"
                        ? "Sent"
                        : camp.status.charAt(0).toUpperCase() +
                          camp.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="dark:text-gray-300">
                    {camp.totalRecipients || camp.recipients?.length}
                  </TableCell>
                  <TableCell className="dark:text-gray-300">
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
                          className="dark:hover:bg-gray-800"
                        >
                          <Edit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => handleDelete(camp._id, e)}
                          className="dark:hover:bg-gray-800"
                        >
                          <Trash className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </Button>
                      </div>
                    )}
                    {camp.status === "active" && (
                      <Clock className="h-4 w-4 ml-auto text-blue-500 dark:text-blue-400" />
                    )}
                    {camp.status === "completed" && (
                      <CheckCircle className="h-4 w-4 ml-auto text-green-500 dark:text-green-400" />
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
            fetchCampaigns();
          }}
          events={events}
          initialData={editingCampaign}
        />
      )}

      <Dialog
        open={!!viewCampaign}
        onOpenChange={(o) => !o && setViewCampaign(null)}
      >
        <DialogContent className="max-w-3xl dark:bg-black dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">Campaign Details</DialogTitle>
          </DialogHeader>
          {viewCampaign && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Campaign Title
                  </h4>
                  <p className="font-semibold dark:text-gray-100">{viewCampaign.title}</p>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Sent Date
                  </h4>
                  <p className="dark:text-gray-300">{new Date(viewCampaign.createdAt).toLocaleString()}</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Message</h4>
                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg text-sm border border-gray-200 dark:border-gray-700 dark:text-gray-300">
                  {viewCampaign.message}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Recipients (
                    {viewCampaign.totalRecipients ||
                      viewCampaign.recipients?.length ||
                      0}
                    )
                  </h4>
                </div>
                <div className="border border-gray-200 dark:border-gray-700 rounded-md">
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-gray-200 dark:border-gray-700">
                          <TableHead className="w-[50px] dark:text-gray-300">#</TableHead>
                          <TableHead className="dark:text-gray-300">Name</TableHead>
                          <TableHead className="dark:text-gray-300">Phone Number</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewCampaign.recipients?.map((r, i) => (
                          <TableRow key={i} className="border-gray-100 dark:border-gray-800">
                            <TableCell className="text-gray-500 dark:text-gray-400">
                              {i + 1}
                            </TableCell>
                            <TableCell className="dark:text-gray-300">{r.name || "N/A"}</TableCell>
                            <TableCell className="font-mono text-xs dark:text-gray-300">
                              {r.phone}
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!viewCampaign.recipients ||
                          viewCampaign.recipients.length === 0) && (
                          <TableRow>
                            <TableCell
                              colSpan={3}
                              className="text-center text-gray-500 dark:text-gray-400 py-4"
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