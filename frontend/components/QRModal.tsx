"use client";
import { useState, useEffect } from "react";
import { QrCode, Download, X } from "lucide-react";
import QRCode from "qrcode";
import { Invitation } from "@/types/invitation";

interface QRModalProps {
  invitation: Invitation;
  onClose: () => void;
}

export default function QRModal({ invitation, onClose }: QRModalProps) {
  const [qrCodeImage, setQrCodeImage] = useState<string>("");

  useEffect(() => {
    const generateQRCode = async () => {
      try {
        if (invitation.qrCode) {
          // If it's already a data URL (base64 image), use it directly
          if (invitation.qrCode.startsWith("data:image")) {
            setQrCodeImage(invitation.qrCode);
            return;
          }

          let qrUrl = invitation.qrCode;

          // Handle JSON array format from old invitations
          if (qrUrl.startsWith("[")) {
            try {
              const urls = JSON.parse(qrUrl);
              qrUrl = urls[0]; // Take first URL
            } catch {
              // If parsing fails, use as is
            }
          }

          const qrImage = await QRCode.toDataURL(qrUrl, {
            width: 300,
            margin: 2,
            color: {
              dark: "#0D47A1",
              light: "#FFFFFF",
            },
          });
          setQrCodeImage(qrImage);
        }
      } catch (error) {
        console.error("Error generating QR code:", error);
      }
    };

    generateQRCode();
  }, [invitation.qrCode]);

  const downloadQR = () => {
    const link = document.createElement("a");
    link.href = qrCodeImage;
    link.download = `${invitation.customerName}-QR.png`;
    link.click();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-gray-200 rounded-xl max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <QrCode className="h-5 w-5 text-blue-600" />
              QR Codes
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {invitation.customerName} - {invitation.eventTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {!qrCodeImage ? (
          <div className="text-center py-8">
            <QrCode className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No QR code available</p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-900">QR Code</h4>
              <button
                onClick={downloadQR}
                className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex justify-center">
                <img
                  src={qrCodeImage}
                  alt="QR Code"
                  className="border border-gray-200 rounded-lg"
                />
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h5 className="font-medium text-gray-900 mb-3">
                    Invitation Details
                  </h5>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">Event:</span>
                      <p className="text-gray-900">{invitation.eventTitle}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Guest:</span>
                      <p className="text-gray-900">{invitation.customerName}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">
                        Contact:
                      </span>
                      <p className="text-gray-900">{invitation.contact}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
