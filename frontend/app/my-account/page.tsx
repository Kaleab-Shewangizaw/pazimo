"use client";

import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Trash2,
  Edit2,
  Save,
  X,
  User,
  Mail,
  Phone,
  Shield,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function MyAccount() {
  const { user, token, setUser, setToken, logout } = useAuthStore();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
  });

  useEffect(() => {
    if (!token) {
      const storedAuth = localStorage.getItem("auth-storage");
      if (storedAuth) {
        try {
          const parsedAuth = JSON.parse(storedAuth);
          const storedToken = parsedAuth.state?.token;
          const storedUser = parsedAuth.state?.user;

          if (storedToken) {
            setToken(storedToken);
          }

          if (storedUser) {
            setUser(storedUser);
            setFormData({
              firstName: storedUser.firstName || "",
              lastName: storedUser.lastName || "",
              email: storedUser.email || "",
              phoneNumber: storedUser.phoneNumber || "",
            });
          }

          if (storedToken) {
            return;
          }
        } catch (error) {
          console.error("Failed to restore auth state:", error);
        }
      }

      router.push("/sign-in");
      return;
    }

    if (!user) {
      return;
    }

    const fetchUserData = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.status === "success" && data.data) {
            setFormData({
              firstName: data.data.firstName || "",
              lastName: data.data.lastName || "",
              email: data.data.email || "",
              phoneNumber: data.data.phoneNumber || "",
            });
            return;
          }
        }

        // Fallback to cached user data
        setFormData({
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          email: user.email || "",
          phoneNumber: user.phoneNumber || "",
        });
      } catch (error) {
        console.error("Failed to fetch user data:", error);
        setFormData({
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          email: user.email || "",
          phoneNumber: user.phoneNumber || "",
        });
      } finally {
        setTimeout(() => setIsLoading(false), 300);
      }
    };

    fetchUserData();
  }, [router, token, user, setUser, setToken]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/update-profile`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setUser(data.data);
        setIsEditing(false);
        toast.success("Profile updated successfully!");
      } else {
        toast.error(data.message || "Failed to update profile");
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      phoneNumber: user?.phoneNumber || "",
    });
    setIsEditing(false);
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/delete-account`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast.success("Account deleted successfully");
        logout();
        router.push("/");
      } else {
        toast.error(data.message || "Failed to delete account");
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          My Account
        </h1>
        <p className="text-gray-500 mt-1">
          Manage your personal information and account settings
        </p>
      </div>

      {/* Profile Card */}
      <Card className="mb-6 md:mb-8 overflow-hidden border-gray-200">
        <CardHeader className="pb-4 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl md:text-2xl">
                  {user.firstName} {user.lastName}
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {user.email?.includes("@admin") ? "Admin" : "User"}
                  </Badge>
                  <span>Member since {new Date().getFullYear()}</span>
                </CardDescription>
              </div>
            </div>

            {!isEditing && (
              <Button
                onClick={() => setIsEditing(true)}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {isEditing ? (
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    First Name
                  </label>
                  <Input
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name
                  </label>
                  <Input
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Address
                  </label>
                  <Input
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone Number
                  </label>
                  <Input
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    required
                    className="h-11"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="sm:flex-1 bg-green-600 hover:bg-green-700 h-11"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  className="sm:flex-1 h-11"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-gray-500 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Full Name
                  </p>
                  <p className="font-medium text-lg">
                    {user.firstName} {user.lastName}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-gray-500 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone Number
                  </p>
                  <p className="font-medium text-lg">{user.phoneNumber}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-gray-500 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Address
                  </p>
                  <p className="font-medium text-lg break-all">{user.email}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">Account Status</p>
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                    Active
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone Card */}
      <Card className="border-red-200">
        <CardHeader className="pb-4 bg-gradient-to-r from-red-50 to-orange-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100">
              <Shield className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <CardTitle className="text-red-700">Danger Zone</CardTitle>
              <CardDescription className="text-red-600">
                Irreversible actions - proceed with caution
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="rounded-lg border border-red-300 bg-white p-4 md:p-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="font-semibold text-red-800 flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    Delete Account
                  </h4>
                  <p className="text-sm text-red-600">
                    Permanently delete your account and all associated data.
                    This action is irreversible.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="w-full md:w-auto bg-red-600 hover:bg-red-700"
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {isDeleting ? "Deleting..." : "Delete Account"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-w-md md:max-w-lg">
                    <AlertDialogHeader>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-full bg-red-100">
                          <Trash2 className="h-6 w-6 text-red-600" />
                        </div>
                        <AlertDialogTitle className="text-red-700">
                          Delete Your Account?
                        </AlertDialogTitle>
                      </div>
                      <AlertDialogDescription className="space-y-3 text-gray-600">
                        <p className="font-medium">
                          This action cannot be undone.
                        </p>
                        <p>
                          This will permanently delete your account and remove
                          all your data, including:
                        </p>
                        <ul className="space-y-2 mt-2 pl-4">
                          <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                            <span>Your profile information</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                            <span>Your ticket purchase history</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                            <span>Your wishlist items</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                            <span>All associated account data</span>
                          </li>
                        </ul>
                        <p className="pt-2 font-medium text-red-600">
                          Are you sure you want to continue?
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex flex-col sm:flex-row gap-2">
                      <AlertDialogCancel className="mt-0 w-full sm:w-auto">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAccount}
                        className="w-full sm:w-auto bg-red-600 hover:bg-red-700"
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Deleting...
                          </>
                        ) : (
                          "Yes, Delete My Account"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Information */}
      <div className="mt-6 text-center text-gray-500 text-sm">
        <p>Need help? Contact our support team at support@pazimo.com</p>
      </div>
    </div>
  );
}
