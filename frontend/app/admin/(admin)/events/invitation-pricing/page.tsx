"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Globe, Lock, DollarSign, Save } from "lucide-react";

export default function InvitationPricingPage() {
  const [pricing, setPricing] = useState({
    public: {
      emailPrice: "10",
      smsPrice: "10"
    },
    private: {
      emailPrice: "10",
      smsPrice: "10"
    }
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPricing();
  }, []);

  const fetchPricing = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/invitation-pricing`);
      if (response.ok) {
        const data = await response.json();
        setPricing({
          public: {
            emailPrice: data.data.public.emailPrice.toString(),
            smsPrice: data.data.public.smsPrice.toString()
          },
          private: {
            emailPrice: data.data.private.emailPrice.toString(),
            smsPrice: data.data.private.smsPrice.toString()
          }
        });
      }
    } catch (error) {
      console.error('Error fetching pricing:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePriceChange = (eventType: "public" | "private", method: "emailPrice" | "smsPrice", value: string) => {
    setPricing(prev => ({
      ...prev,
      [eventType]: {
        ...prev[eventType],
        [method]: value
      }
    }));
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/invitation-pricing`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(pricing)
      });
      
      if (response.ok) {
        alert("Invitation pricing updated successfully!");
      } else {
        alert("Failed to update pricing. Please try again.");
      }
    } catch (error) {
      console.error('Error updating pricing:', error);
      alert("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Invitation Pricing</h1>
            <p className="text-gray-600 mt-1">Manage pricing for event invitations by type and method</p>
          </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Public Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-green-600" />
              Public Events
              <Badge variant="outline" className="text-green-600 border-green-200">
                Open Access
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="public-email">Email Invitation Price</Label>
              <div className="relative mt-1">
                <Input
                  id="public-email"
                  type="number"
                  step="0.01"
                  min="0"
                  value={pricing.public.emailPrice}
                  onChange={(e) => handlePriceChange("public", "emailPrice", e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="public-sms">SMS Invitation Price</Label>
              <div className="relative mt-1">
                <Input
                  id="public-sms"
                  type="number"
                  step="0.01"
                  min="0"
                  value={pricing.public.smsPrice}
                  onChange={(e) => handlePriceChange("public", "smsPrice", e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Private Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-orange-600" />
              Private Events
              <Badge variant="outline" className="text-orange-600 border-orange-200">
                Invitation Only
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="private-email">Email Invitation Price</Label>
              <div className="relative mt-1">
                <Input
                  id="private-email"
                  type="number"
                  step="0.01"
                  min="0"
                  value={pricing.private.emailPrice}
                  onChange={(e) => handlePriceChange("private", "emailPrice", e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="private-sms">SMS Invitation Price</Label>
              <div className="relative mt-1">
                <Input
                  id="private-sms"
                  type="number"
                  step="0.01"
                  min="0"
                  value={pricing.private.smsPrice}
                  onChange={(e) => handlePriceChange("private", "smsPrice", e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pricing Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h4 className="font-medium text-green-600">Public Events</h4>
              <div className="text-sm text-gray-600">
                <div>Email: {pricing.public.emailPrice} birr per invitation</div>
                <div>SMS: {pricing.public.smsPrice} birr per invitation</div>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-orange-600">Private Events</h4>
              <div className="text-sm text-gray-600">
                <div>Email: {pricing.private.emailPrice} birr per invitation</div>
                <div>SMS: {pricing.private.smsPrice} birr per invitation</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave}
          disabled={isSubmitting}
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {isSubmitting ? "Saving..." : "Save Changes"}
        </Button>
          </div>
        </>
      )}
    </div>
  );
}