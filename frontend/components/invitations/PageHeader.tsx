import React from "react";
import { Send, Mail } from "lucide-react";

interface PageHeaderProps {
  activeTab: "send" | "sent";
  setActiveTab: (tab: "send" | "sent") => void;
}

export default function PageHeader({
  activeTab,
  setActiveTab,
}: PageHeaderProps) {
  return (
    <div className="flex dark:bg-black flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 ">Invitations</h1>
        <p className="text-gray-600 mt-2 dark:text-gray-400">
          Manage and send invitations for your events
        </p>
      </div>

      <div className="flex bg-white dark:bg-black p-1 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
        <button
          onClick={() => setActiveTab("send")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
            activeTab === "send"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50 dark:hover:text-gray-100"
          }`}
        >
          <Send className="h-4 w-4" />
          Send Invitations
        </button>
        <button
          onClick={() => setActiveTab("sent")}
          className={`flex items-center gap-2  px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
            activeTab === "sent"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50 dark:hover:text-gray-100"
          }`}
        >
          <Mail className="h-4 w-4" />
          Sent History
        </button>
      </div>
    </div>
  );
}
