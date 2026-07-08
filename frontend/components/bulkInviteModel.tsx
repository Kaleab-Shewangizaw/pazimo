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
  activePaymentProvider,
}: {
  event: Event;
  setShowBulkModal: (show: boolean) => void;
  activePaymentProvider: "SANTIM" | "CHAPA";
}) {
  console.log("BulkInvite activePaymentProvider:", activePaymentProvider);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [data, setData] = useState<Row[]>([]);
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const [pricing, setPricing] = useState({ email: 2, sms: 5 });
  const [ticketType, setTicketType] = useState("Regular");

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

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size exceeds 5MB limit. Please upload a smaller file.");
      return;
    }

    setSelectedFile(file);
    setMissingColumns([]);

    const reader = new FileReader();

    reader.onload = (e) => {
      const arrayBuffer = e.target?.result;
      const fileType = file.type;

      if (fileType.includes("csv")) {
        parseCsv(arrayBuffer as ArrayBuffer);
      } else if (
        fileType.includes("spreadsheetml") ||
        fileType.includes("excel")
      ) {
        parseExcel(arrayBuffer as ArrayBuffer);
      } else {
        alert("Unsupported file type.");
      }
    };

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
    return header.trim();
  };

  const parseCsv = (arrayBuffer: ArrayBuffer) => {
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      defval: "",
    }) as unknown[][];

    const results = parseSheetData(jsonData);
    processData(results);
  };

  const parseSheetData = (jsonData: unknown[][]): Record<string, string>[] => {
    if (jsonData.length === 0) return [];

    const originalHeaders = (jsonData[0] || []) as unknown[];
    const headers = originalHeaders.map((h) => normalizeHeader(String(h ?? "")));

    const hasName = headers.includes("Name");
    const hasContact = headers.includes("Email") || headers.includes("Phone");

    const missing = [];
    if (!hasName) missing.push("Name");
    if (!hasContact) missing.push("Email or Phone");

    if (missing.length > 0) {
      setMissingColumns(missing);
      toast.error(`Missing columns: ${missing.join(", ")}`);
    }

    return jsonData
      .slice(1)
      .filter((row) =>
        (row || []).some((cell) => String(cell ?? "").trim() !== "")
      )
      .map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((header, index) => {
        if (!header) return;
        const value = row[index];
        if (value === undefined || value === null) return;
        if (header === "Message") {
          obj[header] = String(value).replace(/\r\n/g, "\n");
          return;
        }
        obj[header] = String(value).trim();
      });
      return obj;
    });
  };

  const parseExcel = (arrayBuffer: ArrayBuffer) => {
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      defval: "",
    }) as unknown[][];

    const results = parseSheetData(jsonData);
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
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 max-h-screen">
      <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl max-w-8xl w-full p-6 md:p-8 shadow-xl relative">
        <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Bulk Invitation Upload
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Upload CSV/Excel file for:{" "}
          <strong className="text-gray-900 dark:text-gray-100">{event?.title}</strong>
        </p>

        {missingColumns.length > 0 && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
            <div className="p-1 bg-red-100 dark:bg-red-900/30 rounded-full">
              <svg
                className="w-4 h-4 text-red-600 dark:text-red-400"
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
              <h4 className="text-sm font-semibold text-red-800 dark:text-red-300">
                Missing Required Columns
              </h4>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                The uploaded file is missing the following required columns:{" "}
                <strong>{missingColumns.join(", ")}</strong>. Please ensure your
                file has these headers in the first row.
              </p>
            </div>
            <button
              onClick={() => setMissingColumns([])}
              className="text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="space-y-4">
          {!selectedFile && (
            <div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-200 mb-2">
                  Default Ticket Type
                </label>
                <select
                  value={ticketType}
                  onChange={(e) => setTicketType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-black text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                >
                  <option value="Regular">Regular</option>
                  <option value="VIP">VIP</option>
                  <option value="VVIP">VVIP</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This will be applied if not specified in the file.
                </p>
              </div>

              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-200">
                  Upload File
                </label>
                <div className="flex gap-1">
                  <button
                    onClick={() => downloadTemplate("email")}
                    className="text-xs bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800/50 text-blue-700 dark:text-blue-400 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                  >
                    <Mail className="h-3 w-3" />
                    Email
                  </button>
                  <button
                    onClick={() => downloadTemplate("phone")}
                    className="text-xs bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-800/50 text-green-700 dark:text-green-400 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                  >
                    <Phone className="h-3 w-3" />
                    SMS
                  </button>
                  <button
                    onClick={() => downloadTemplate("mixed")}
                    className="text-xs bg-gray-100 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300 px-2 py-1 rounded flex items-center gap-1 transition-colors"
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
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-black text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400 dark:hover:file:bg-blue-800/50"
              />
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                Supported formats: CSV, Excel (.xlsx, .xls)
              </p>
            </div>
          )}

          {selectedFile && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {selectedFile.name}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
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
              activePaymentProvider={activePaymentProvider}
              ticketType={ticketType}
            />
          )}

          {!selectedFile && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  File Format Requirements
                </h4>
                <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-blue-600 dark:text-blue-400">Column A:</span>
                    <span>
                      Customer Name (Required)
                      <br />
                      Example: &quot;John Doe&quot;
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-blue-600 dark:text-blue-400">Column B:</span>
                    <span>
                      Email or Phone (Required)
                      <br />
                      Example: &quot;john@example.com&quot; or
                      &quot;+1234567890&quot;
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-blue-600 dark:text-blue-400">Column C:</span>
                    <span>
                      Contact Type (Required)
                      <br />
                      Must be &quot;email&quot; or &quot;phone&quot;
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-blue-600 dark:text-blue-400">Column D:</span>
                    <span>
                      Ticket Type (Optional)
                      <br />
                      Example: &quot;Regular&quot;, &quot;VIP&quot;
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-blue-600 dark:text-blue-400">Column E:</span>
                    <span>
                      Amount (Optional)
                      <br />
                      Number of tickets (Default: 1)
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-blue-600 dark:text-blue-400">Column F:</span>
                    <span>
                      Message (Optional)
                      <br />
                      Personal message for invitation
                    </span>
                  </li>
                </ul>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                    Pricing Information
                  </h4>
                  <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Email invitations:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {pricing.email} ETB each
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>SMS invitations:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {pricing.sms} ETB each
                      </span>
                    </div>
                    <div className="border-t border-green-300 dark:border-green-700 pt-2 mt-2">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        Cost calculated after file upload
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Important Notes:
                  </h4>
                  <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
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
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200 font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}