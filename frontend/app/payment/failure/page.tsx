"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { XCircle, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

function PaymentFailureContent() {
  const searchParams = useSearchParams();
  const txnId = searchParams.get("txn");

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="mb-6 flex justify-center">
          <XCircle className="w-20 h-20 text-red-500" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Payment Failed
        </h1>

        <p className="text-gray-600 mb-6">
          We couldn&apos;t process your payment. Please try again or use a
          different payment method.
        </p>

        {txnId && (
          <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-6 text-sm text-red-800 flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Ref: {txnId}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => window.history.back()}
            className="block w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentFailurePage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
      <PaymentFailureContent />
    </Suspense>
  );
}
