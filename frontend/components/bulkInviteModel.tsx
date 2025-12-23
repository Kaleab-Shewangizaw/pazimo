import {
  DollarSign,
  Download,
  FileSpreadsheet,
  Mail,
  Phone,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import * as XLSX from "xlsx";
import EditableTable from "./BulkTableView";
import { validateAndCorrectRows } from "@/utils/bulkInviteValidation";
import { toast } from "sonner";
import { Row } from "@/types/bulk-invite";
import { Event } from "@/types/invitation";

export default function BulkInvite({
  event,
  setShowBulkModal,
}: {
  event: Event;
  setShowBulkModal: (show: boolean) => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [data, setData] = useState<Row[]>([]);
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const [pricing, setPricing] = useState({ email: 2, sms: 5 });

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/invitation-pricing`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            const isPublic = event?.isPublic !== false;
            const type = isPublic ? "public" : "private";
            const typePricing = data.data[type];
            if (typePricing) {
              setPricing({
                email: typePricing.emailPrice,
                sms: typePricing.smsPrice,
              });
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch pricing:", error);
      }
    };

    fetchPricing();
  }, [event]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files ? event.target.files[0] : null;
    if (!file) return;

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size exceeds 5MB limit. Please upload a smaller file.");
      return;
    }

    setSelectedFile(file);
    setMissingColumns([]); // Reset missing columns on new file

    const reader = new FileReader();

    reader.onload = (e) => {
      const arrayBuffer = e.target?.result;
      const fileType = file.type;

      if (fileType.includes("csv")) {
        parseCsv(arrayBuffer as ArrayBuffer);
      } else if (
        fileType.includes("spreadsheetml") || // For .xlsx
        fileType.includes("excel") // For .xls
      ) {
        parseExcel(arrayBuffer as ArrayBuffer);
      } else {
        alert("Unsupported file type.");
      }
    };

    // Read the file as an ArrayBuffer, which works for both parsers
    reader.readAsArrayBuffer(file);
  };

  const processData = (rawData: unknown[]) => {
    if (Array.isArray(rawData) && rawData.length > 1000) {
      toast.error(
        "File contains more than 1000 rows. Please split into smaller files."
      );
      setSelectedFile(null);
      return;
    }

    const { correctedRows, summary } = validateAndCorrectRows(
      rawData as Row[],
      pricing
    );

    setData(correctedRows as never[]);

    if (summary.errors.length > 0) {
      toast.warning(
        `Found ${summary.errors.length} issues in the uploaded file. Please review the highlighted rows.`
      );
    } else {
      toast.success(`Successfully processed ${correctedRows.length} contacts.`);
    }
  };

  const normalizeHeader = (header: string): string => {
    const h = header.trim().toLowerCase();
    if (h === "name" || h === "guestname" || h === "guest name") return "Name";
    if (h === "email" || h === "guestemail" || h === "guest email")
      return "Email";
    if (
      h === "phone" ||
      h === "phonenumber" ||
      h === "mobile" ||
      h === "guestphone"
    )
      return "Phone";
    if (h === "type" || h === "contacttype") return "Type";
    if (h === "tickettype" || h === "ticket type" || h === "ticket")
      return "TicketType";
    if (h === "amount" || h === "quantity" || h === "count") return "Amount";
    if (h === "message" || h === "note") return "Message";
    return header.trim(); // Return original if no match
  };

  const parseCsv = (arrayBuffer: ArrayBuffer) => {
    // csv-parser works with streams/strings. We decode the ArrayBuffer to a string.
    const textDecoder = new TextDecoder("utf-8");
    const csvString = textDecoder.decode(arrayBuffer);
    const results: any[] = [];

    // Simulate a stream behavior for the parser with a simple split/forEach approach
    // For a true stream in the browser, you might use different utility libraries,
    // but a string split works for basic cases.

    // Using a utility funct{ title: "Sample Event" };ion might be cleaner if needed. For simplicity:
    const lines = csvString.split("\n");
    if (lines.length < 1) return;

    const headers = lines[0].split(",").map(normalizeHeader);

    // Check for missing required columns
    const hasName = headers.includes("Name");
    const hasContact = headers.includes("Email") || headers.includes("Phone");

    const missing = [];
    if (!hasName) missing.push("Name");
    if (!hasContact) missing.push("Email or Phone");

    if (missing.length > 0) {
      setMissingColumns(missing);
      toast.error(`Missing columns: ${missing.join(", ")}`);
    }

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = lines[i].split(",");
      const obj: Record<string, string> = {};
      headers.forEach((header, index) => {
        if (values[index]) {
          obj[header] = values[index].trim();
        }
      });
      results.push(obj);
    }

    processData(results);
  };

  const parseExcel = (arrayBuffer: ArrayBuffer) => {
    // xlsx expects the data in a specific format (e.g., Uint8Array or binary string)
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Get headers first to normalize
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
    }) as any[][];
    if (jsonData.length === 0) return;

    const originalHeaders = jsonData[0] as string[];
    const headers = originalHeaders.map((h) => normalizeHeader(String(h)));

    // Check for missing required columns
    const hasName = headers.includes("Name");
    const hasContact = headers.includes("Email") || headers.includes("Phone");

    const missing = [];
    if (!hasName) missing.push("Name");
    if (!hasContact) missing.push("Email or Phone");

    if (missing.length > 0) {
      setMissingColumns(missing);
      toast.error(`Missing columns: ${missing.join(", ")}`);
    }

    const results = jsonData.slice(1).map((row) => {
      const obj: Record<string, any> = {};
      headers.forEach((header, index) => {
        if (row[index] !== undefined) {
          obj[header] = row[index];
        }
      });
      return obj;
    });

    processData(results);
  };

  const downloadTemplate = (type: string) => {
    let csvContent = "Name,Email,Phone,Type,Ticket Type,Amount,Message\n";
    if (type === "email") {
      csvContent +=
        "John Doe,johndoe@example.com,,Email,Regular,1,Hello John!\n";
    } else if (type === "phone") {
      csvContent += "Jane Doe,,+251911223344,Phone,VIP,1,Hello Jane!\n";
    } else if (type === "mixed") {
      csvContent +=
        "John Doe,johndoe@example.com,,Email,Regular,1,Hello John!\nJane Doe,,+251911223344,Phone,VIP,2,Hello Jane!\n";
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const fileName = `invitation_template_${type}.csv`;
    const file = new File([blob], fileName, { type: "text/csv" });

    setSelectedFile(file);

    // Parse the file content to update the table
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        parseCsv(e.target.result as ArrayBuffer);
      }
    };
    reader.readAsArrayBuffer(blob);

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 max-h-screen">
      <div className="bg-white border border-gray-200 rounded-xl max-w-6xl w-full p-6 md:p-8 shadow-xl relative">
        <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-blue-600" />
          Bulk Invitation Upload
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Upload CSV/Excel file for:{" "}
          <strong className="text-gray-900">{event?.title}</strong>
        </p>

        {missingColumns.length > 0 && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <div className="p-1 bg-red-100 rounded-full">
              <svg
                className="w-4 h-4 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-800">
                Missing Required Columns
              </h4>
              <p className="text-sm text-red-700 mt-1">
                The uploaded file is missing the following required columns:{" "}
                <strong>{missingColumns.join(", ")}</strong>. Please ensure your
                file has these headers in the first row.
              </p>
            </div>
            <button
              onClick={() => setMissingColumns([])}
              className="text-red-400 hover:text-red-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="space-y-4">
          {!selectedFile && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-900">
                  Upload File
                </label>
                <div className="flex gap-1">
                  <button
                    onClick={() => downloadTemplate("email")}
                    className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                  >
                    <Mail className="h-3 w-3" />
                    Email
                  </button>
                  <button
                    onClick={() => downloadTemplate("phone")}
                    className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                  >
                    <Phone className="h-3 w-3" />
                    SMS
                  </button>
                  <button
                    onClick={() => downloadTemplate("mixed")}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                  >
                    <Download className="h-3 w-3" />
                    Mixed
                  </button>
                </div>
              </div>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
              />
              <p className="text-xs text-gray-600 mt-2">
                Supported formats: CSV, Excel (.xlsx, .xls)
              </p>
            </div>
          )}

          {selectedFile && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-900">
                    {selectedFile.name}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  File size: {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="mt-2"
                onClick={() => setSelectedFile(null)}
              >
                Remove File
              </Button>
            </div>
          )}

          {selectedFile && (
            <EditableTable
              setSelectedFile={setSelectedFile}
              setShowBulkModal={setShowBulkModal}
              data={data}
              setData={setData}
              event={event}
            />
          )}

          {!selectedFile && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                  File Format Requirements
                </h4>
                <ul className="text-xs text-gray-600 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-blue-600">Column A:</span>
                    <span>
                      Customer Name (Required)
                      <br />
                      Example: &quot;John Doe&quot;
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-blue-600">Column B:</span>
                    <span>
                      Email or Phone (Required)
                      <br />
                      Example: &quot;john@example.com&quot; or
                      &quot;+1234567890&quot;
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-blue-600">Column C:</span>
                    <span>
                      Contact Type (Required)
                      <br />
                      Must be &quot;email&quot; or &quot;phone&quot;
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-blue-600">Column D:</span>
                    <span>
                      Ticket Type (Optional)
                      <br />
                      Example: &quot;Regular&quot;, &quot;VIP&quot;
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-blue-600">Column E:</span>
                    <span>
                      Amount (Optional)
                      <br />
                      Number of tickets (Default: 1)
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-blue-600">Column F:</span>
                    <span>
                      Message (Optional)
                      <br />
                      Personal message for invitation
                    </span>
                  </li>
                </ul>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    Pricing Information
                  </h4>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div className="flex justify-between">
                      <span>Email invitations:</span>
                      <span className="font-medium">
                        {pricing.email} ETB each
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>SMS invitations:</span>
                      <span className="font-medium">
                        {pricing.sms} ETB each
                      </span>
                    </div>
                    <div className="border-t border-green-300 pt-2 mt-2">
                      <div className="font-medium text-gray-900">
                        Cost calculated after file upload
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">
                    Important Notes:
                  </h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Maximum 1000 contacts per upload</li>
                    <li>• Invalid rows will be skipped</li>
                    <li>• Duplicate contacts will be ignored</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => {
              if (setShowBulkModal) setShowBulkModal(false);
              setSelectedFile(null);
            }}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 transition-all duration-200 font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
