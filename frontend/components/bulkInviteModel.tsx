import {
  DollarSign,
  Download,
  FileSpreadsheet,
  Mail,
  Phone,
} from "lucide-react";
import { useState } from "react";
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files ? event.target.files[0] : null;
    if (!file) return;

    setSelectedFile(file);

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
    const { correctedRows, summary } = validateAndCorrectRows(rawData as Row[]);

    setData(correctedRows as never[]);

    if (summary.errors.length > 0) {
      toast.warning(
        `Found ${summary.errors.length} issues in the uploaded file. Please review the highlighted rows.`
      );
    } else {
      toast.success(`Successfully processed ${correctedRows.length} contacts.`);
    }
  };

  const parseCsv = (arrayBuffer: ArrayBuffer) => {
    // csv-parser works with streams/strings. We decode the ArrayBuffer to a string.
    const textDecoder = new TextDecoder("utf-8");
    const csvString = textDecoder.decode(arrayBuffer);
    const results = [];

    // Simulate a stream behavior for the parser with a simple split/forEach approach
    // For a true stream in the browser, you might use different utility libraries,
    // but a string split works for basic cases.

    // Using a utility funct{ title: "Sample Event" };ion might be cleaner if needed. For simplicity:
    const lines = csvString.split("\n");
    const headers = lines[0].split(",");
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i]) continue;
      const values = lines[i].split(",");
      const obj: Record<string, string> = {};
      headers.forEach((header, index) => {
        obj[header.trim()] = values[index].trim();
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
    const json_data = XLSX.utils.sheet_to_json(worksheet);

    processData(json_data);
  };

  const selectedEvent = event || { title: "Unnamed Event", id: 0 };
  const pricing = { email: 2, sms: 5 };

  const downloadTemplate = (type: string) => {
    let csvContent = "Customer Name,Contact,Contact Type,Amount,Message\n";
    if (type === "email") {
      csvContent += "John Doe,johndoe@example.com,email,1,Hello John!\n";
    } else if (type === "phone") {
      csvContent += "Jane Doe,+1234567890,phone,1,Hello Jane!\n";
    } else if (type === "mixed") {
      csvContent +=
        "John Doe,johndoe@example.com,email,1,Hello John!\nJane Doe,+1234567890,phone,2,Hello Jane!\n";
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-gray-200 rounded-xl max-w-6xl w-full p-6 md:p-8 shadow-xl relative">
        <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-blue-600" />
          Bulk Invitation Upload
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Upload CSV/Excel file for:{" "}
          <strong className="text-gray-900">{selectedEvent?.title}</strong>
        </p>

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
                      Amount (Optional)
                      <br />
                      Number of tickets (Default: 1)
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-blue-600">Column E:</span>
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
                    <li>• File size limit: 5MB</li>
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
