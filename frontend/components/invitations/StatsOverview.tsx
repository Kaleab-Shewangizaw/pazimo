import React from "react";
import {
  BarChart3,
  Mail,
  Phone,
  TrendingUp,
  DollarSign,
  CheckCircle,
  XCircle,
} from "lucide-react";

interface StatsOverviewProps {
  stats: {
    totalInvitations: number;
    emailInvitations: number;
    smsInvitations: number;
    deliveredInvitations: number;
    publicEvents: number;
    privateEvents: number;
  };
  pricing?: {
    email: number;
    sms: number;
  };
}

export default function StatsOverview({
  stats,
  pricing = { email: 2.5, sms: 7.5 },
}: StatsOverviewProps) {
  const {
    totalInvitations,
    emailInvitations,
    smsInvitations,
    deliveredInvitations,
    publicEvents,
    privateEvents,
  } = stats;

  const emailCost = emailInvitations * pricing.email;
  const smsCost = smsInvitations * pricing.sms;
  const totalCost = emailCost + smsCost;
  const deliveryRate =
    totalInvitations > 0
      ? Math.round((deliveredInvitations / totalInvitations) * 100)
      : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
      <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 font-medium">
              Total Invitations
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {totalInvitations}
            </p>
          </div>
          <div className="p-2 bg-blue-50 rounded-lg">
            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 font-medium">
              Email Invitations
            </p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {emailInvitations}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {emailCost.toFixed(2)} ETB
            </p>
          </div>
          <div className="p-2 bg-blue-50 rounded-lg">
            <Mail className="h-5 w-5 text-blue-600" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 font-medium">SMS Invitations</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {smsInvitations}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {smsCost.toFixed(2)} ETB
            </p>
          </div>
          <div className="p-2 bg-blue-50 rounded-lg">
            <Phone className="h-5 w-5 text-blue-600" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 font-medium">Delivery Rate</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {deliveryRate}%
            </p>
          </div>
          <div className="p-2 bg-green-50 rounded-lg">
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 font-medium">Total Cost</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {totalCost.toFixed(2)} ETB
            </p>
          </div>
          <div className="p-2 bg-gray-50 rounded-lg">
            <DollarSign className="h-5 w-5 text-gray-600" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 font-medium">Public Events</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {publicEvents}
            </p>
          </div>
          <div className="p-2 bg-green-50 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 font-medium">Private Events</p>
            <p className="text-2xl font-bold text-red-600 mt-1">
              {privateEvents}
            </p>
          </div>
          <div className="p-2 bg-red-50 rounded-lg">
            <XCircle className="h-5 w-5 text-red-600" />
          </div>
        </div>
      </div>
    </div>
  );
}
