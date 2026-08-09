"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Beer, Plus, Trash2 } from "lucide-react";
import { EventFormSection } from "./event-form-section";
import { getBeverageColorVars } from "@/lib/beverage-color";

export interface BeverageSelection {
  beverageId: string;
  name: string;
  image?: string | null;
  color?: string | null;
  price: string;
}

interface CatalogBeverage {
  _id: string;
  name: string;
  image?: string | null;
  color?: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const buildImageUrl = (image?: string | null) => (image ? `${API_URL}${image}` : null);

interface BeveragesSectionProps {
  token: string;
  selections: BeverageSelection[];
  onChange: (selections: BeverageSelection[]) => void;
}

// Shown during event creation, before the event exists. Choices are held here
// and posted to the event's line-up once it has an id — see the create page's
// submit handler.
export function BeveragesSection({ token, selections, onChange }: BeveragesSectionProps) {
  const [catalog, setCatalog] = useState<CatalogBeverage[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoadingCatalog(true);
    fetch(`${API_URL}/api/beverages/organizer/catalog`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setCatalog(data?.data || []))
      .catch(() => setCatalog([]))
      .finally(() => setLoadingCatalog(false));
  }, [token]);

  const addable = catalog.filter(
    (beverage) => !selections.some((selection) => selection.beverageId === beverage._id)
  );

  const addBeverage = (beverage: CatalogBeverage) => {
    onChange([
      ...selections,
      {
        beverageId: beverage._id,
        name: beverage.name,
        image: beverage.image,
        color: beverage.color,
        price: "",
      },
    ]);
    setPickerOpen(false);
  };

  const setPrice = (beverageId: string, price: string) => {
    onChange(
      selections.map((selection) =>
        selection.beverageId === beverageId ? { ...selection, price } : selection
      )
    );
  };

  const remove = (beverageId: string) => {
    onChange(selections.filter((selection) => selection.beverageId !== beverageId));
  };

  return (
    <EventFormSection id="beverages">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">
            Beverage sales
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Optional. Guests buy drinks ahead of the event, so price below what they&apos;d pay at
            the door.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (addable.length === 0) {
              toast.error(
                catalog.length === 0
                  ? "There are no drinks approved for you yet"
                  : "Every approved drink is already on this event"
              );
              return;
            }
            setPickerOpen(true);
          }}
          disabled={loadingCatalog}
        >
          <Plus className="mr-2 h-4 w-4" /> Add a drink
        </Button>
      </div>

      {selections.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 px-6 py-10 text-center dark:border-slate-700">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
            <Beer className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No drinks yet. You can also add them after the event is created.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {selections.map((selection) => (
            <div
              key={selection.beverageId}
              style={getBeverageColorVars(selection.color)}
              className="flex items-center gap-3 rounded-[20px] border border-[var(--bev-border)] p-3 dark:border-[var(--bev-border-dark)]"
            >
              {buildImageUrl(selection.image) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={buildImageUrl(selection.image)!}
                  alt={selection.name}
                  className="h-12 w-12 rounded-md bg-[var(--bev-panel)] object-contain p-1 dark:bg-[var(--bev-panel-dark)]"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[var(--bev-panel)] dark:bg-[var(--bev-panel-dark)]">
                  <Beer className="h-5 w-5 text-[var(--bev-ink)] dark:text-[var(--bev-ink-dark)]" />
                </div>
              )}
              <span className="flex-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                {selection.name}
              </span>
              <div className="w-32">
                <Label htmlFor={`price-${selection.beverageId}`} className="sr-only">
                  Price for {selection.name} in ETB
                </Label>
                <Input
                  id={`price-${selection.beverageId}`}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Price (ETB)"
                  value={selection.price}
                  onChange={(e) => setPrice(selection.beverageId, e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${selection.name}`}
                onClick={() => remove(selection.beverageId)}
              >
                <Trash2 className="h-4 w-4 text-red-600 dark:text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a drink</DialogTitle>
            <DialogDescription>
              Pick a drink to sell at this event, then set its price.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[45vh] space-y-1 overflow-y-auto pr-1">
            {addable.map((beverage) => (
              <button
                key={beverage._id}
                type="button"
                onClick={() => addBeverage(beverage)}
                className="flex w-full items-center gap-3 rounded-lg border border-transparent p-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {buildImageUrl(beverage.image) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={buildImageUrl(beverage.image)!}
                    alt={beverage.name}
                    className="h-10 w-10 rounded-md object-contain"
                  />
                ) : (
                  <div
                    style={getBeverageColorVars(beverage.color)}
                    className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--bev-panel)] dark:bg-[var(--bev-panel-dark)]"
                  >
                    <Beer className="h-4 w-4 text-[var(--bev-ink)] dark:text-[var(--bev-ink-dark)]" />
                  </div>
                )}
                <span className="flex-1 text-sm font-medium">{beverage.name}</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPickerOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EventFormSection>
  );
}
