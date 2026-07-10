"use client";

import { CalendarDays } from "lucide-react";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import { cn } from "@/lib/utils";

import { formatDateValue, parseDateValue } from "../_lib/event-form-utils";

interface DatePickerInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
  className?: string;
}

export function DatePickerInput({
  id,
  value,
  onChange,
  placeholder = "Select a date",
  minDate,
  maxDate,
  className,
}: DatePickerInputProps) {
  return (
    <div className="relative">
      <CalendarDays className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
      <ReactDatePicker
        id={id}
        selected={parseDateValue(value)}
        onChange={(date) => onChange(formatDateValue(date))}
        dateFormat="MMMM d, yyyy"
        placeholderText={placeholder}
        minDate={parseDateValue(minDate)}
        maxDate={parseDateValue(maxDate)}
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        autoComplete="off"
        showPopperArrow={false}
        popperClassName="z-[70]"
        calendarClassName="event-date-picker"
        wrapperClassName="!block w-full"
        onChangeRaw={(event) => event.preventDefault()}
        className={cn(
          "h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-4 text-sm text-slate-900 dark:text-slate-100 shadow-sm transition-colors outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900/40",
          className,
        )}
      />
    </div>
  );
}
