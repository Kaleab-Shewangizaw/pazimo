"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Megaphone } from "lucide-react";
import { toast } from "sonner";

export default function CampaignPricingPage() {
  const [smsPrice, setSmsPrice] = useState("5");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPricing();
  }, []);

  const fetchPricing = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/campaign-pricing`
      );

      if (response.ok) {
        const data = await response.json();
        setSmsPrice(data.data?.smsPrice?.toString?.() || "5");
      }
    } catch (error) {
      console.error("Error fetching campaign pricing:", error);
      toast.error("Failed to load campaign pricing");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    const parsedPrice = parseFloat(smsPrice);

    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error("Please enter a valid non-negative campaign SMS price");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("adminToken");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/campaign-pricing`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ smsPrice: parsedPrice }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update campaign pricing");
      }

      toast.success("Campaign pricing updated successfully");
    } catch (error) {
      console.error("Error updating campaign pricing:", error);
      toast.error("Failed to update campaign pricing");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Campaign Pricing</h1>
            {/* <p className="text-gray-600 mt-1">
              Manage one SMS campaign price for all event types
            </p> */}
          </div>

          <Card className="">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5" />
                Campaign SMS Price
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* <Label htmlFor="campaign-sms-price">SMS Campaign Price</Label> */}
              <Input
                id="campaign-sms-price"
                type="number"
                min="0"
                step="0.01"
                value={smsPrice}
                onChange={(e) => setSmsPrice(e.target.value)}
                placeholder="0.00"
               
              />
              <p className="text-sm text-gray-600 mt-3">
                SMS: {smsPrice || "0"} birr per recipient
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSubmitting} className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
