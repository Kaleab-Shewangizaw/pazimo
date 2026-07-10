import type React from "react";
import { Clock3, Globe2, MapPin, ShieldCheck } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

import { DatePickerInput } from "./date-picker-input";
import { EventFormSection } from "./event-form-section";
import { FieldGroup, FieldHint } from "./field-group";
import type { Category, EventFormData } from "../_lib/event-form-types";

interface BasicInfoSectionProps {
  formData: EventFormData;
  categories: Category[];
  isLoadingCategories: boolean;
  currentDate: string;
  onFieldChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  onCategoryChange: (value: string) => void;
  onVisibilityChange: (value: string) => void;
  onAgeRestrictionToggle: (checked: boolean) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
}

export function BasicInfoSection({
  formData,
  categories,
  isLoadingCategories,
  currentDate,
  onFieldChange,
  onCategoryChange,
  onVisibilityChange,
  onAgeRestrictionToggle,
  onStartDateChange,
  onEndDateChange,
  onStartTimeChange,
  onEndTimeChange,
}: BasicInfoSectionProps) {
  return (
    <EventFormSection id="basics">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <div className="space-y-6">
          <FieldGroup>
            <Label htmlFor="title">Event title</Label>
            <Input
              id="title"
              name="title"
              value={formData.title}
              onChange={onFieldChange}
              placeholder="title"
              required
              className="h-11 rounded-xl border-slate-200 dark:border-slate-800"
            />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={onFieldChange}
              placeholder="description"
              required
              className="min-h-36 rounded-2xl border-slate-200 dark:border-slate-800"
            />
          </FieldGroup>

          <div className="grid gap-4 md:grid-cols-2">
            <FieldGroup>
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={onCategoryChange}
                disabled={isLoadingCategories}
              >
                <SelectTrigger id="category" className="h-11 rounded-xl border-slate-200 dark:border-slate-800">
                  <SelectValue
                    placeholder={
                      isLoadingCategories
                        ? "Loading categories..."
                        : "Select category"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category._id} value={category._id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldGroup>

            <FieldGroup>
              <Label htmlFor="event-type">Visibility</Label>
              <Select
                value={formData.isPublic ? "public" : "private"}
                onValueChange={onVisibilityChange}
              >
                <SelectTrigger
                  id="event-type"
                  className="h-11 rounded-xl border-slate-200 dark:border-slate-800"
                >
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public event</SelectItem>
                  <SelectItem value="private">Private event</SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FieldGroup>
              <Label htmlFor="capacity">Capacity</Label>
              <Input
                id="capacity"
                name="capacity"
                type="number"
                min="0"
                value={formData.capacity}
                onChange={onFieldChange}
                placeholder="How many attendees can you host?"
                required
                className="h-11 rounded-xl border-slate-200 dark:border-slate-800"
              />
            </FieldGroup>

            <FieldGroup>
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                name="tags"
                value={formData.tags}
                onChange={onFieldChange}
                placeholder="music, festival, after party"
                className="h-11 rounded-xl border-slate-200 dark:border-slate-800"
              />
              <FieldHint>Optional. Comma-separated keywords for internal organization.</FieldHint>
            </FieldGroup>
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-4 sm:p-5">
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Schedule</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Reference date: {currentDate}</p>
              </div>
              <Badge className="rounded-full bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800">
                Local timezone
              </Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="startDate">Start date</Label>
                <DatePickerInput
                  id="startDate"
                  value={formData.startDate}
                  onChange={onStartDateChange}
                  placeholder="Choose the opening date"
                />
              </FieldGroup>

              <FieldGroup>
                <Label htmlFor="endDate">End date</Label>
                <DatePickerInput
                  id="endDate"
                  value={formData.endDate}
                  minDate={formData.startDate}
                  onChange={onEndDateChange}
                  placeholder="Choose the closing date"
                />
              </FieldGroup>

              <FieldGroup>
                <Label htmlFor="startTime" className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  Start time
                </Label>
                <Input
                  id="startTime"
                  name="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => onStartTimeChange(e.target.value)}
                  required
                  className="h-11 rounded-xl border-slate-200 dark:border-slate-800"
                />
              </FieldGroup>

              <FieldGroup>
                <Label htmlFor="endTime" className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  End time
                </Label>
                <Input
                  id="endTime"
                  name="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => onEndTimeChange(e.target.value)}
                  required
                  className="h-11 rounded-xl border-slate-200 dark:border-slate-800"
                />
              </FieldGroup>
            </div>

            <div id="venue" className="grid gap-4">
              <FieldGroup>
                <Label htmlFor="location.address" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  Venue
                </Label>
                <Input
                  id="location.address"
                  name="location.address"
                  value={formData.location.address}
                  onChange={onFieldChange}
                  placeholder="Venue name or full address"
                  className="h-11 rounded-xl border-slate-200 dark:border-slate-800"
                />
              </FieldGroup>

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldGroup>
                  <Label htmlFor="location.city">City</Label>
                  <Input
                    id="location.city"
                    name="location.city"
                    value={formData.location.city}
                    onChange={onFieldChange}
                    placeholder="Addis Ababa"
                    required
                    className="h-11 rounded-xl border-slate-200 dark:border-slate-800"
                  />
                </FieldGroup>

                <FieldGroup>
                  <Label htmlFor="location.country" className="flex items-center gap-2">
                    <Globe2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                    Country
                  </Label>
                  <Input
                    id="location.country"
                    name="location.country"
                    value={formData.location.country}
                    onChange={onFieldChange}
                    placeholder="Ethiopia"
                    required
                    className="h-11 rounded-xl border-slate-200 dark:border-slate-800"
                  />
                </FieldGroup>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Age restriction</p>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Turn this on only if entry depends on an age range.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2">
            <Switch
              id="age-restriction-toggle"
              checked={formData.ageRestriction.hasRestriction}
              onCheckedChange={onAgeRestrictionToggle}
            />
            <Label htmlFor="age-restriction-toggle" className="cursor-pointer text-sm">
              {formData.ageRestriction.hasRestriction ? "Enabled" : "Disabled"}
            </Label>
          </div>
        </div>

        {formData.ageRestriction.hasRestriction ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <FieldGroup>
              <Label htmlFor="ageRestriction.minAge">Minimum age</Label>
              <Input
                id="ageRestriction.minAge"
                name="ageRestriction.minAge"
                type="number"
                min="0"
                max="120"
                value={formData.ageRestriction.minAge}
                onChange={onFieldChange}
                placeholder="18"
                className="h-11 rounded-xl border-slate-200 dark:border-slate-800"
              />
            </FieldGroup>

            <FieldGroup>
              <Label htmlFor="ageRestriction.maxAge">Maximum age</Label>
              <Input
                id="ageRestriction.maxAge"
                name="ageRestriction.maxAge"
                type="number"
                min="0"
                max="120"
                value={formData.ageRestriction.maxAge}
                onChange={onFieldChange}
                placeholder="60"
                className="h-11 rounded-xl border-slate-200 dark:border-slate-800"
              />
            </FieldGroup>
          </div>
        ) : null}
      </div>
    </EventFormSection>
  );
}
