"use client";

import { useState } from "react";
import CreateCampaignPage from "./createCampaign";
import CampaignHistoryPage from "./campaignHistory";

export default function CampaignPage() {
  const [currentPage, setCurrentPage] = useState(true);

  // Fetch Tickets when Event Changes

  return (
    <div className="px-4 flex flex-col w-full h-[calc(100vh-4rem)] overflow-hidden">
      <div className="w-full flex items-between py-2  mb-0 shrink-0">
        {currentPage ? (
          <div className="text-xl font-semibold">Create Campaign</div>
        ) : (
          <div className="text-xl font-semibold">Campaign History </div>
        )}
        <div className="ml-auto">
          <div className="bg-gray-100 p-1 rounded-lg flex gap-1">
            <button
              onClick={() => setCurrentPage(true)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${
                currentPage
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setCurrentPage(false)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${
                !currentPage
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              History
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {currentPage ? <CreateCampaignPage /> : <CampaignHistoryPage />}
      </div>
    </div>
  );
}
