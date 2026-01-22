"use client";

import { useState } from "react";
import CreateCampaignPage from "./createCampaign";
import CampaignHistoryPage from "./campaignHistory";

export default function CampaignPage() {
  const [currentPage, setCurrentPage] = useState(true);

  // Fetch Tickets when Event Changes

  return (
    <div className="px-4 flex flex-col w-full ">
      <div className="w-full flex items-between py-4 border-y-1 border-gray-300 mb-4">
        {currentPage ? (
          <div className="text-xl font-semibold">Create Campaign</div>
        ) : (
          <div className="text-xl font-semibold">Campaign History </div>
        )}
        <div className="ml-auto">
          {currentPage ? (
            <button
              onClick={() => setCurrentPage(false)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
            >
              View Campaign History
            </button>
          ) : (
            <button
              onClick={() => setCurrentPage(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
            >
              Create New Campaign
            </button>
          )}
        </div>
      </div>
      {currentPage ? <CreateCampaignPage /> : <CampaignHistoryPage />}
    </div>
  );
}
