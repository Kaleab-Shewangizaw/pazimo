"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import { toast } from "sonner";
import {
  getBeverageColorVars,
  getBeverageSwatch,
  isValidHexColor,
  BEVERAGE_COLOR_PRESETS,
  DEFAULT_BEVERAGE_COLOR,
} from "@/lib/beverage-color";
import {
  Beer,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Building2,
  ShieldCheck,
  ShieldOff,
  Plus,
  Pencil,
  Trash2,
  Power,
  RotateCcw,
  Check,
  Minus,
} from "lucide-react";

type Eligibility = "eligible" | "not_eligible";

interface Beverage {
  _id: string;
  name: string;
  image?: string | null;
  color?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface OrganizerBeverageRow {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  createdAt: string;
  eligibility: Eligibility;
  eligibilitySetAt: string | null;
  eligibilityNotes: string | null;
  // Drinks this organizer may NOT sell. Empty means no restrictions.
  blockedBeverages: string[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const buildImageUrl = (image?: string | null) => {
  if (!image) return null;
  return `${API_URL}${image}`;
};

const SelectAllBox = ({
  state,
  onToggle,
  label,
}: {
  state: "all" | "none" | "some";
  onToggle: () => void;
  label: string;
}) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={state === "all" ? "true" : state === "none" ? "false" : "mixed"}
    onClick={onToggle}
    className="flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500/50 dark:border-gray-700 dark:bg-gray-900/50"
  >
    <span
      className={`flex size-4 shrink-0 items-center justify-center rounded-[4px] border shadow-xs ${
        state === "none"
          ? "border-input dark:bg-input/30"
          : "border-primary bg-primary text-primary-foreground"
      }`}
    >
      {state === "all" && <Check className="size-3.5" />}
      {state === "some" && <Minus className="size-3.5" />}
    </span>
    <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{label}</span>
  </button>
);

const EligibilityBadge = ({ eligibility }: { eligibility: Eligibility }) => (
  <Badge
    className={
      eligibility === "eligible"
        ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
        : "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
    }
  >
    {eligibility === "eligible" ? "Eligible" : "Not eligible"}
  </Badge>
);

export default function BeveragesPage() {
  const { token, admin } = useAdminAuthStore();
  const isPartner = admin?.role === "partner";

  const [tab, setTab] = useState("beverages");

  // Beverage catalogue state
  const [beverages, setBeverages] = useState<Beverage[]>([]);
  const [beveragesLoading, setBeveragesLoading] = useState(true);
  const [beverageSearch, setBeverageSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [beveragePage, setBeveragePage] = useState(1);
  const [beverageTotalPages, setBeverageTotalPages] = useState(1);
  const [beverageStats, setBeverageStats] = useState({ active: 0, inactive: 0, total: 0 });

  // Create / edit dialog
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Beverage | null>(null);
  const [formName, setFormName] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formColor, setFormColor] = useState(DEFAULT_BEVERAGE_COLOR);
  const [formImage, setFormImage] = useState<File | null>(null);
  const [formImagePreview, setFormImagePreview] = useState<string | null>(null);
  const [savingBeverage, setSavingBeverage] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Beverage | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Organizer eligibility state
  const [organizers, setOrganizers] = useState<OrganizerBeverageRow[]>([]);
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgSearch, setOrgSearch] = useState("");
  const [orgPage, setOrgPage] = useState(1);
  const [orgTotalPages, setOrgTotalPages] = useState(1);
  const [eligibleCount, setEligibleCount] = useState(0);
  const [eligibilityDialogOpen, setEligibilityDialogOpen] = useState(false);
  const [eligibilityTarget, setEligibilityTarget] = useState<OrganizerBeverageRow | null>(null);
  const [eligibilityChoice, setEligibilityChoice] = useState<Eligibility>("eligible");
  const [eligibilityNotes, setEligibilityNotes] = useState("");
  const [savingEligibility, setSavingEligibility] = useState(false);

  // Per-organizer beverage picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<OrganizerBeverageRow | null>(null);
  const [pickerSelection, setPickerSelection] = useState<string[]>([]);
  const [pickerCatalog, setPickerCatalog] = useState<Beverage[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [savingPicker, setSavingPicker] = useState(false);

  const fetchBeverages = useCallback(async () => {
    try {
      setBeveragesLoading(true);
      const params = new URLSearchParams({
        page: String(beveragePage),
        limit: "10",
        ...(beverageSearch ? { search: beverageSearch } : {}),
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      });
      const res = await fetch(`${API_URL}/api/beverages/admin?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to load beverages");
      setBeverages(data.data);
      setBeverageTotalPages(data.pagination?.pages || 1);
      setBeverageStats(data.stats || { active: 0, inactive: 0, total: 0 });
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to load beverages");
    } finally {
      setBeveragesLoading(false);
    }
  }, [beveragePage, beverageSearch, statusFilter, token]);

  const fetchOrganizers = useCallback(async () => {
    try {
      setOrgLoading(true);
      const params = new URLSearchParams({
        page: String(orgPage),
        limit: "10",
        ...(orgSearch ? { search: orgSearch } : {}),
        // The "Eligible" tab reuses this table, restricted to eligible organizers.
        ...(tab === "eligible" ? { eligibility: "eligible" } : {}),
      });
      const res = await fetch(`${API_URL}/api/beverages/admin/organizers?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to load organizers");
      setOrganizers(data.data);
      setOrgTotalPages(data.pagination?.pages || 1);
      setEligibleCount(data.stats?.eligible || 0);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to load organizers");
    } finally {
      setOrgLoading(false);
    }
  }, [orgPage, orgSearch, token, tab]);

  useEffect(() => {
    if (!token) return;
    if (tab === "beverages") fetchBeverages();
  }, [token, tab, fetchBeverages]);

  useEffect(() => {
    if (!token) return;
    if (tab === "organizers" || tab === "eligible") fetchOrganizers();
  }, [token, tab, fetchOrganizers]);

  // --- Beverage catalogue actions -----------------------------------------

  const openCreateDialog = () => {
    setEditing(null);
    setFormName("");
    setFormActive(true);
    setFormColor(DEFAULT_BEVERAGE_COLOR);
    setFormImage(null);
    setFormImagePreview(null);
    setFormOpen(true);
  };

  const openEditDialog = (beverage: Beverage) => {
    setEditing(beverage);
    setFormName(beverage.name);
    setFormActive(beverage.isActive);
    setFormColor(getBeverageSwatch(beverage.color));
    setFormImage(null);
    setFormImagePreview(buildImageUrl(beverage.image));
    setFormOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormImage(file);
    const reader = new FileReader();
    reader.onload = () => setFormImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveBeverage = async () => {
    if (!formName.trim()) {
      toast.error("A beverage name is required");
      return;
    }
    try {
      setSavingBeverage(true);
      const body = new FormData();
      body.append("name", formName.trim());
      body.append("color", formColor);
      body.append("isActive", String(formActive));
      if (formImage) body.append("image", formImage);

      const res = await fetch(
        editing ? `${API_URL}/api/beverages/admin/${editing._id}` : `${API_URL}/api/beverages/admin`,
        {
          method: editing ? "PATCH" : "POST",
          // No Content-Type header: the browser sets the multipart boundary.
          headers: { Authorization: `Bearer ${token}` },
          body,
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to save beverage");

      toast.success(editing ? "Beverage updated" : "Beverage created");
      setFormOpen(false);
      fetchBeverages();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save beverage");
    } finally {
      setSavingBeverage(false);
    }
  };

  const handleToggleActive = async (beverage: Beverage) => {
    try {
      const res = await fetch(`${API_URL}/api/beverages/admin/${beverage._id}/status`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive: !beverage.isActive }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to update status");
      toast.success(beverage.isActive ? "Beverage deactivated" : "Beverage activated");
      fetchBeverages();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const res = await fetch(`${API_URL}/api/beverages/admin/${deleteTarget._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to delete beverage");
      toast.success("Beverage deleted");
      setDeleteTarget(null);
      fetchBeverages();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete beverage");
    } finally {
      setDeleting(false);
    }
  };

  // --- Eligibility actions -------------------------------------------------

  const openEligibilityDialog = (organizer: OrganizerBeverageRow) => {
    setEligibilityTarget(organizer);
    setEligibilityChoice(organizer.eligibility === "eligible" ? "not_eligible" : "eligible");
    setEligibilityNotes("");
    setEligibilityDialogOpen(true);
  };

  const handleSaveEligibility = async () => {
    if (!eligibilityTarget) return;
    try {
      setSavingEligibility(true);
      const res = await fetch(
        `${API_URL}/api/beverages/admin/organizers/${eligibilityTarget._id}/eligibility`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ eligibility: eligibilityChoice, notes: eligibilityNotes }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to update eligibility");
      toast.success(
        eligibilityChoice === "eligible"
          ? "Organizer can now sell beverages at their events"
          : "Beverage selling revoked for this organizer"
      );
      setEligibilityDialogOpen(false);
      fetchOrganizers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update eligibility");
    } finally {
      setSavingEligibility(false);
    }
  };

  const openPicker = async (organizer: OrganizerBeverageRow) => {
    setPickerTarget(organizer);
    setPickerCatalog([]);
    setPickerSelection([]);
    setPickerOpen(true);

    // The catalogue is only needed once the dialog is actually opened, and it
    // has to be the full list rather than the current page of the grid. The
    // ticks can only be derived once it arrives: everything starts ticked
    // except what this organizer is already blocked from.
    try {
      setPickerLoading(true);
      const res = await fetch(`${API_URL}/api/beverages/admin?limit=500`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to load beverages");
      const blocked = organizer.blockedBeverages || [];
      setPickerCatalog(data.data);
      setPickerSelection(
        (data.data as Beverage[]).map((b) => b._id).filter((id) => !blocked.includes(id))
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load beverages");
    } finally {
      setPickerLoading(false);
    }
  };

  const togglePickerBeverage = (beverageId: string) => {
    setPickerSelection((current) =>
      current.includes(beverageId)
        ? current.filter((id) => id !== beverageId)
        : [...current, beverageId]
    );
  };

  // The dialog works in ticks (what they can sell); the API stores the denials.
  // Deriving the complement from the loaded catalogue means a beverage added by
  // someone else while this dialog was open stays allowed rather than being
  // blocked by omission.
  const saveBlockedBeverages = async (allowedIds: string[]) => {
    if (!pickerTarget) return;
    const blockedBeverageIds = pickerCatalog
      .map((beverage) => beverage._id)
      .filter((id) => !allowedIds.includes(id));

    try {
      setSavingPicker(true);
      const res = await fetch(
        `${API_URL}/api/beverages/admin/organizers/${pickerTarget._id}/beverages`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ blockedBeverageIds }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to save beverages");
      toast.success(
        blockedBeverageIds.length === 0
          ? "Organizer can sell every active beverage"
          : `Organizer blocked from ${blockedBeverageIds.length} beverage${
              blockedBeverageIds.length === 1 ? "" : "s"
            }`
      );
      setPickerOpen(false);
      fetchOrganizers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save beverages");
    } finally {
      setSavingPicker(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <div className="container mx-auto py-10 p-10 max-w-7xl">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Beverages</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage the beverage catalogue and which organizers may sell drinks at their events
            </p>
          </div>
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v);
            setOrgPage(1);
          }}
        >
          <TabsList className="mb-6">
            <TabsTrigger value="beverages">
              <Beer className="h-4 w-4 mr-1.5" /> Beverages
              {beverageStats.total ? (
                <Badge className="ml-1.5 bg-amber-500 text-white">{beverageStats.total}</Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="organizers">
              <Building2 className="h-4 w-4 mr-1.5" /> Organizers
            </TabsTrigger>
            <TabsTrigger value="eligible">
              <ShieldCheck className="h-4 w-4 mr-1.5" /> Eligible
              {eligibleCount ? (
                <Badge className="ml-1.5 bg-emerald-500 text-white">{eligibleCount}</Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>

          {/* ---------------- Beverage catalogue tab ----------------
              A grid of product cards rather than a table: a drink is
              recognised by its bottle, and a table row shrinks the one
              identifying feature down to a thumbnail. */}
          <TabsContent value="beverages">
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-[260px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 h-4 w-4" />
                      <Input
                        placeholder="Search beverages..."
                        value={beverageSearch}
                        onChange={(e) => {
                          setBeverageSearch(e.target.value);
                          setBeveragePage(1);
                        }}
                        className="pl-10 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200"
                      />
                    </div>
                    <Select
                      value={statusFilter}
                      onValueChange={(v) => {
                        setStatusFilter(v);
                        setBeveragePage(1);
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-[170px] dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={fetchBeverages} variant="outline">
                      <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                    </Button>
                    {!isPartner && (
                      <Button
                        onClick={openCreateDialog}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Plus className="mr-2 h-4 w-4" /> Add beverage
                      </Button>
                    )}
                  </div>
                </div>

              {beveragesLoading ? (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
                    >
                      <Skeleton className="aspect-square rounded-none" />
                      <div className="p-4">
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : beverages.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-800/50">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
                    <Beer className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {beverageSearch || statusFilter !== "all"
                      ? "No beverages match this filter"
                      : "No beverages yet"}
                  </p>
                  <p className="mt-1 max-w-sm text-sm text-gray-600 dark:text-gray-400">
                    {beverageSearch || statusFilter !== "all"
                      ? "Try a different search or clear the status filter."
                      : "Add the first drink that eligible organizers can sell at their events."}
                  </p>
                  {!isPartner && !beverageSearch && statusFilter === "all" && (
                    <Button
                      onClick={openCreateDialog}
                      className="mt-5 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Plus className="mr-2 h-4 w-4" /> Add beverage
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {beverages.map((beverage) => (
                    <div
                      key={beverage._id}
                      style={getBeverageColorVars(beverage.color)}
                      className="flex flex-col overflow-hidden rounded-2xl border border-[var(--bev-border)] bg-white shadow-sm transition-shadow hover:shadow-md dark:border-[var(--bev-border-dark)] dark:bg-gray-800"
                    >
                      {/* Bottles are tall and often shot on their own background,
                          so the image is contained on a tinted shelf rather than
                          cropped to fill. The image is positioned absolutely and
                          the panel is shrink-0: a flex item's min-height:auto
                          would otherwise let a tall bottle stretch the panel and
                          break the grid's alignment. */}
                      <div className="relative aspect-square shrink-0 overflow-hidden bg-gradient-to-b from-[var(--bev-panel)] to-[var(--bev-panel-2)] dark:from-[var(--bev-panel-dark)] dark:to-[var(--bev-panel-2-dark)]">
                        {buildImageUrl(beverage.image) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={buildImageUrl(beverage.image)!}
                            alt={beverage.name}
                            className={`absolute inset-0 h-full w-full object-contain p-6 ${
                              beverage.isActive ? "" : "opacity-40 grayscale"
                            }`}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Beer className="h-10 w-10 text-amber-300 dark:text-amber-900" />
                          </div>
                        )}
                        <Badge
                          className={`absolute right-3 top-3 ${
                            beverage.isActive
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900"
                              : "bg-gray-200 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                          }`}
                        >
                          {beverage.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>

                      <div className="flex flex-1 items-start p-4">
                        <h3 className="line-clamp-2 font-semibold leading-tight text-gray-900 dark:text-gray-100">
                          {beverage.name}
                        </h3>
                      </div>

                      {!isPartner && (
                        <div className="flex items-center gap-2 border-t border-gray-100 px-4 py-3 dark:border-gray-700">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleActive(beverage)}
                            className={`flex-1 ${
                              beverage.isActive
                                ? "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900"
                                : "border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                            }`}
                          >
                            <Power className="mr-1 h-4 w-4" />
                            {beverage.isActive ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(beverage)}
                            aria-label={`Edit ${beverage.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(beverage)}
                            aria-label={`Delete ${beverage.name}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-600 dark:text-red-500" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {beveragePage} of {beverageTotalPages} · {beverageStats.active} active,{" "}
                  {beverageStats.inactive} inactive
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBeveragePage((p) => Math.max(p - 1, 1))}
                    disabled={beveragePage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBeveragePage((p) => Math.min(p + 1, beverageTotalPages))}
                    disabled={beveragePage === beverageTotalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ---------------- Organizers / Eligible tab ----------------
              One panel serves both tabs: its value tracks whichever of the two
              is active, so the table renders for "organizers" and "eligible"
              (the latter fetches with an eligibility=eligible filter). */}
          <TabsContent value={tab === "eligible" ? "eligible" : "organizers"}>
            <Card className="border border-gray-200 dark:border-gray-700 shadow-lg border-t-4 border-t-emerald-600 dark:bg-gray-800">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div className="relative w-full sm:w-[320px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 h-4 w-4" />
                    <Input
                      placeholder="Search organizers..."
                      value={orgSearch}
                      onChange={(e) => {
                        setOrgSearch(e.target.value);
                        setOrgPage(1);
                      }}
                      className="pl-10 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200"
                    />
                  </div>
                  <Button onClick={fetchOrganizers} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-200 dark:border-gray-700">
                        <TableHead className="dark:text-gray-300">Organizer</TableHead>
                        <TableHead className="dark:text-gray-300">Phone</TableHead>
                        <TableHead className="dark:text-gray-300">Joined</TableHead>
                        <TableHead className="dark:text-gray-300">Beverage selling</TableHead>
                        <TableHead className="dark:text-gray-300">Can sell</TableHead>
                        <TableHead className="dark:text-gray-300">Set on</TableHead>
                        <TableHead className="dark:text-gray-300 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orgLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12 text-gray-500 dark:text-gray-400">
                            Loading organizers...
                          </TableCell>
                        </TableRow>
                      ) : organizers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12 text-gray-500 dark:text-gray-400">
                            <Building2 className="h-8 w-8 text-emerald-400 mx-auto mb-3" />
                            No organizers found
                          </TableCell>
                        </TableRow>
                      ) : (
                        organizers.map((org) => (
                          <TableRow key={org._id} className="border-gray-100 dark:border-gray-700">
                            <TableCell>
                              <p className="font-medium text-gray-900 dark:text-gray-100">
                                {org.firstName} {org.lastName}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{org.email}</p>
                            </TableCell>
                            <TableCell className="text-gray-600 dark:text-gray-400">
                              {org.phoneNumber || "—"}
                            </TableCell>
                            <TableCell className="text-gray-600 dark:text-gray-400">
                              {new Date(org.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <EligibilityBadge eligibility={org.eligibility} />
                            </TableCell>
                            <TableCell>
                              {org.blockedBeverages.length === 0 ? (
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  All active
                                </span>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                                >
                                  {org.blockedBeverages.length} blocked
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-gray-600 dark:text-gray-400">
                              {org.eligibilitySetAt
                                ? new Date(org.eligibilitySetAt).toLocaleDateString()
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {!isPartner && (
                                <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openPicker(org)}
                                  className="border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/30"
                                >
                                  <Beer className="h-4 w-4 mr-1" />
                                  Beverages
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEligibilityDialog(org)}
                                  className={
                                    org.eligibility === "eligible"
                                      ? "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900"
                                      : "border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                                  }
                                >
                                  {org.eligibility === "eligible" ? (
                                    <ShieldOff className="h-4 w-4 mr-1" />
                                  ) : (
                                    <ShieldCheck className="h-4 w-4 mr-1" />
                                  )}
                                  {org.eligibility === "eligible" ? "Revoke" : "Mark eligible"}
                                </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Page {orgPage} of {orgTotalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOrgPage((p) => Math.max(p - 1, 1))}
                      disabled={orgPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOrgPage((p) => Math.min(p + 1, orgTotalPages))}
                      disabled={orgPage === orgTotalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create / edit beverage dialog */}
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto dark:bg-gray-800 dark:border-gray-700">
            <DialogHeader>
              <DialogTitle className="dark:text-gray-100">
                {editing ? "Edit beverage" : "Add beverage"}
              </DialogTitle>
              <DialogDescription className="dark:text-gray-400">
                Beverages in this list are what eligible organizers can pick from and price for
                their own events.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="beverage-name" className="dark:text-gray-300">
                  Name
                </Label>
                <Input
                  id="beverage-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Heineken 330ml"
                  className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="beverage-image" className="dark:text-gray-300">
                  Image
                </Label>
                <Input
                  id="beverage-image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                />
              </div>

              {/* Colour, previewed on the real card rather than as an abstract
                  swatch — the tint is the thing being chosen, and only the hue
                  of this pick survives into it. */}
              <div className="space-y-2">
                <Label className="dark:text-gray-300">Colour</Label>
                <div className="flex flex-wrap gap-2">
                  {BEVERAGE_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setFormColor(preset.value)}
                      title={preset.name}
                      aria-label={preset.name}
                      aria-pressed={formColor.toLowerCase() === preset.value}
                      className={`h-7 w-7 rounded-full border transition-transform hover:scale-110 ${
                        formColor.toLowerCase() === preset.value
                          ? "border-gray-900 ring-2 ring-gray-900/20 dark:border-white dark:ring-white/30"
                          : "border-black/10 dark:border-white/20"
                      }`}
                      style={{ backgroundColor: preset.value }}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Custom colour"
                    value={isValidHexColor(formColor) ? formColor : DEFAULT_BEVERAGE_COLOR}
                    onChange={(e) => setFormColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border border-gray-200 bg-transparent p-1 dark:border-gray-700"
                  />
                  <Input
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    placeholder="#1f7a3f"
                    aria-invalid={!isValidHexColor(formColor)}
                    className="w-32 font-mono text-sm dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                  />
                 
                </div>

                <div
                  style={getBeverageColorVars(isValidHexColor(formColor) ? formColor : null)}
                  className="mt-1 w-36 overflow-hidden rounded-2xl border border-[var(--bev-border)] bg-white dark:border-[var(--bev-border-dark)] dark:bg-gray-800"
                >
                  <div className="relative aspect-square bg-gradient-to-b from-[var(--bev-panel)] to-[var(--bev-panel-2)] dark:from-[var(--bev-panel-dark)] dark:to-[var(--bev-panel-2-dark)]">
                    {formImagePreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={formImagePreview}
                        alt=""
                        className="absolute inset-0 h-full w-full object-contain p-4"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Beer className="h-8 w-8 text-[var(--bev-ink)] opacity-40 dark:text-[var(--bev-ink-dark)]" />
                      </div>
                    )}
                  </div>
                  <p className="truncate p-2.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {formName.trim() || "Preview"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Switch id="beverage-active" checked={formActive} onCheckedChange={setFormActive} />
                <Label htmlFor="beverage-active" className="dark:text-gray-300">
                  {formActive ? "Active — organizers can select it" : "Inactive — hidden from organizers"}
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveBeverage}
                disabled={savingBeverage}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {savingBeverage ? "Saving..." : editing ? "Save changes" : "Create beverage"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes the beverage from the catalogue. To keep it on record but
                hide it from organizers, deactivate it instead.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Per-organizer beverage picker */}
        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogContent className="sm:max-w-lg dark:bg-gray-800 dark:border-gray-700">
            <DialogHeader>
              <DialogTitle className="dark:text-gray-100">Beverages this organizer can sell</DialogTitle>
              
            </DialogHeader>

            {/* Select-all sits at the top of the list it controls and carries the
                indeterminate state, so the tick summary is readable at a glance. */}
            {!pickerLoading && pickerCatalog.length > 0 && (
              <SelectAllBox
                state={
                  pickerSelection.length === pickerCatalog.length
                    ? "all"
                    : pickerSelection.length === 0
                    ? "none"
                    : "some"
                }
                // Partial ticks all, matching the usual select-all convention.
                onToggle={() =>
                  setPickerSelection(
                    pickerSelection.length === pickerCatalog.length
                      ? []
                      : pickerCatalog.map((beverage) => beverage._id)
                  )
                }
                label={
                  pickerSelection.length === pickerCatalog.length
                    ? "All beverages"
                    : pickerSelection.length === 0
                    ? "None selected"
                    : `${pickerSelection.length} of ${pickerCatalog.length} selected`
                }
              />
            )}

            <div className="max-h-[45vh] space-y-1 overflow-y-auto pr-1">
              {pickerLoading ? (
                <div className="space-y-2 py-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : pickerCatalog.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  There are no beverages in the catalogue yet.
                </p>
              ) : (
                pickerCatalog.map((beverage) => {
                  const checked = pickerSelection.includes(beverage._id);
                  return (
                    <label
                      key={beverage._id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 transition-colors ${
                        checked
                          ? "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30"
                          : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-900"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => togglePickerBeverage(beverage._id)}
                      />
                      {buildImageUrl(beverage.image) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={buildImageUrl(beverage.image)!}
                          alt={beverage.name}
                          className="h-10 w-10 rounded-md object-contain"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-900">
                          <Beer className="h-4 w-4 text-gray-400 dark:text-gray-600" />
                        </div>
                      )}
                      <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {beverage.name}
                      </span>
                      {!beverage.isActive && (
                        <Badge className="bg-gray-200 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
                          Inactive
                        </Badge>
                      )}
                    </label>
                  );
                })
              )}
            </div>

            {/* <p className="text-xs text-gray-500 dark:text-gray-400">
              {pickerCatalog.length - pickerSelection.length === 0
                ? "No restrictions. Beverages added later stay available to this organizer."
                : `Blocked from ${pickerCatalog.length - pickerSelection.length} of ${
                    pickerCatalog.length
                  } beverages. Beverages added later stay available unless blocked here.`}
            </p> */}

            <DialogFooter className="sm:justify-between">
              {pickerSelection.length < pickerCatalog.length ? (
                <Button
                  variant="outline"
                  onClick={() => setPickerSelection(pickerCatalog.map((b) => b._id))}
                  disabled={savingPicker}
                  className="border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-300"
                >
                  <RotateCcw className="mr-1.5 h-4 w-4" />
                  Tick all
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPickerOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => saveBlockedBeverages(pickerSelection)}
                  disabled={savingPicker || pickerLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {savingPicker ? "Saving..." : "Save selection"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Eligibility dialog */}
        <Dialog open={eligibilityDialogOpen} onOpenChange={setEligibilityDialogOpen}>
          <DialogContent className="sm:max-w-md dark:bg-gray-800 dark:border-gray-700">
            <DialogHeader>
              <DialogTitle className="dark:text-gray-100">
                {eligibilityChoice === "eligible" ? "Mark eligible" : "Revoke eligibility"}
              </DialogTitle>
              <DialogDescription className="dark:text-gray-400">
                {eligibilityTarget?.firstName} {eligibilityTarget?.lastName} —{" "}
                {eligibilityChoice === "eligible"
                  ? "will be able to select beverages and set their selling price for their events."
                  : "will no longer be able to add beverages to their events."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label className="dark:text-gray-300">Notes (optional)</Label>
              <Textarea
                value={eligibilityNotes}
                onChange={(e) => setEligibilityNotes(e.target.value)}
                placeholder="Reason for this decision"
                rows={3}
                className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEligibilityDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveEligibility}
                disabled={savingEligibility}
                className={
                  eligibilityChoice === "eligible"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-red-600 hover:bg-red-700 text-white"
                }
              >
                {savingEligibility ? "Saving..." : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
