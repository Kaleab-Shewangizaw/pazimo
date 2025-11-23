"use client";

import { QRCodeCanvas } from "qrcode.react";
import { Button } from "./ui/button";
import { Row } from "@/types/bulk-invite";

export default function QrModal({
  row,
  onClose,
}: {
  row: Row;
  onClose: () => void;
}) {
  const qrData = JSON.stringify({
    id: row.id,
    name: row.Name,
    email: row.Email,
    phone: row.Phone,
    type: row.Type,
    amount: row.Amount,
    message: row.Message,
    eventDetail: row.eventDetail,
  });

  console.log("event detail is here: ", row.eventDetail);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl p-6 w-[340px] shadow-2xl border border-gray-200 animate-fadeIn">
        <h2 className="text-lg font-semibold mb-4 text-center">
          Invitation QR Code
        </h2>

        <div className="flex justify-center mb-4">
          <div className="p-3 bg-white rounded-lg border shadow-sm">
            <QRCodeCanvas value={qrData} size={200} />
          </div>
        </div>

        <div className="space-y-1 text-sm mt-4">
          <Detail label="Name" value={row.Name} />
          <Detail label="Phone" value={row.Phone} />
          <Detail label="Email" value={row.Email} />
          <Detail label="Amount" value={String(row.Amount || 1)} />
          <Detail label="Message" value={row.Message || "-"} />
        </div>

        {row.eventDetail && (
          <div className="mt-4 p-3 rounded-lg bg-gray-50 border text-xs">
            <p className="font-semibold mb-1">Event</p>
            <p>{row.eventDetail.title}</p>
            <p>{row.eventDetail.location}</p>
            <p>{row.eventDetail.startDate}</p>
          </div>
        )}

        <Button onClick={onClose} className="mt-5 w-full font-medium">
          Close
        </Button>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <p>
      <strong>{label}:</strong> {value}
    </p>
  );
}
