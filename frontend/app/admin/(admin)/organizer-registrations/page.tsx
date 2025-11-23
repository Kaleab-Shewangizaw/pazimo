"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Search, 
  RefreshCw, 
  Eye, 
  Check, 
  X, 
  FileText, 
  User, 
  Mail, 
  Phone, 
  Building, 
  Calendar, 
  MapPin, 
  Users, 
  Star, 
  Megaphone, 
  Ticket 
} from "lucide-react"
import { useAdminAuthStore } from "@/store/adminAuthStore"
import { toast } from "sonner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Separator } from "@/components/ui/separator"

interface OrganizerRegistration {
  _id: string;
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    isActive: boolean;
  };
  organization: string;
  email: string;
  phoneNumber: string;
  eventDetails: {
    expectedAttendees: number;
    offerPromo: boolean;
    marketingSupport: boolean;
    frontPageAd: boolean;
    onsiteSupport: boolean;
  };
  status: 'pending' | 'approved' | 'rejected';
  adminNotes?: string;
  organizerType?: string;
  organizerTypeOther?: string;
  socialLinks?: string;
  businessLicenseUrl?: string;
  tinNumber?: string;
  nationalIdNumber?: string;
  businessAddress?: string;
  bankAccountHolder?: string;
  bankName?: string;
  bankAccountNumber?: string;
  contactRole?: string;
  hasOrganizedBefore?: string;
  eventKinds?: string[];
  eventKindOther?: string;
  sampleEventName?: string;
  estimatedAudience?: string;
  eventFrequency?: string;
  payoutMethod?: string;
  needSupport?: string;
  useQrScanner?: string;
  agreeTerms?: boolean;
  agreeFee?: boolean;
  digitalSignature?: boolean;
  createdAt: string;
}

export default function OrganizerRegistrationsPage() {
  const { token } = useAdminAuthStore()
  const [registrations, setRegistrations] = useState<OrganizerRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("All")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [selectedRegistration, setSelectedRegistration] = useState<OrganizerRegistration | null>(null)
  const [actionDialogOpen, setActionDialogOpen] = useState(false)
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null)
  const [adminNotes, setAdminNotes] = useState("")

  useEffect(() => {
    fetchRegistrations()
  }, [currentPage, itemsPerPage])

  const fetchRegistrations = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/organizers/registrations?page=${currentPage}&limit=${itemsPerPage}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        }
      )

      // Handle 304 Not Modified response
      if (response.status === 304) {
        // Data hasn't changed, keep existing data
        setLoading(false)
        return
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch registrations: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      setRegistrations(data.data.registrations)
      setTotalPages(data.data.totalPages)
    } catch (error) {
      console.error('Error fetching registrations:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to fetch registrations')
    } finally {
      setLoading(false)
    }
  }

  const handleView = (registration: OrganizerRegistration) => {
    setSelectedRegistration(registration)
    setViewDialogOpen(true)
  }

  const handleAction = (registration: OrganizerRegistration, type: 'approve' | 'reject') => {
    setSelectedRegistration(registration)
    setActionType(type)
    setActionDialogOpen(true)
  }

  const confirmAction = async () => {
    if (!selectedRegistration || !actionType) return

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/organizers/registrations/${selectedRegistration._id}/status`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: actionType === 'approve' ? 'approved' : 'rejected',
            adminNotes
          }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to update registration status')
      }

      toast.success(`Registration ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`)
      fetchRegistrations()
    } catch (error) {
      console.error('Error updating registration:', error)
      toast.error('Failed to update registration status')
    } finally {
      setActionDialogOpen(false)
      setActionType(null)
      setAdminNotes("")
    }
  }

  const filteredRegistrations = registrations.filter(registration => {
    if (!registration.userId) return false;
    const searchStr = `${registration.userId.firstName || ''} ${registration.userId.lastName || ''} ${registration.organization || ''}`.toLowerCase()
    const matchesSearch = searchStr.includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "All" || registration.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading registrations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10 p-10">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Organizer Registrations</h1>
        <div className="flex items-center gap-4">
          <Select
            value={itemsPerPage.toString()}
            onValueChange={(value) => {
              setItemsPerPage(Number(value))
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Items per page" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 per page</SelectItem>
              <SelectItem value="10">10 per page</SelectItem>
              <SelectItem value="15">15 per page</SelectItem>
              <SelectItem value="20">20 per page</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchRegistrations} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <Input
            placeholder="Search by name or organization..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={setStatusFilter}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organizer</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead> Audience</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRegistrations.map((registration) => (
              <TableRow key={registration._id}>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {registration.userId?.firstName || 'N/A'} {registration.userId?.lastName || ''}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {registration.userId?.email || registration.email || 'No email'}
                    </div>
                  </div>
                </TableCell>
                <TableCell>{registration.organization || 'N/A'}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium">{registration.estimatedAudience || 'N/A'}</div>
                    <div className="flex flex-wrap gap-1">
                      {registration.eventDetails?.offerPromo && <Badge variant="outline">Offer Promo</Badge>}
                      {registration.eventDetails?.marketingSupport && <Badge variant="outline">Marketing</Badge>}
                      {registration.eventDetails?.frontPageAd && <Badge variant="outline">Front Page</Badge>}
                      {registration.eventDetails?.onsiteSupport && <Badge variant="outline">Onsite</Badge>}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {registration.createdAt ? new Date(registration.createdAt).toLocaleDateString() : 'N/A'}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      registration.status === 'approved'
                        ? 'text-green-600 border-green-600'
                        : registration.status === 'rejected'
                        ? 'text-red-600 border-red-600'
                        : 'text-yellow-600 border-yellow-600'
                    }
                  >
                    {registration.status || 'Unknown'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleView(registration)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {registration.status === 'pending' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-green-600 hover:text-green-700"
                        onClick={() => handleAction(registration, 'approve')}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleAction(registration, 'reject')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-muted-foreground">
          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalPages * itemsPerPage)} of {totalPages * itemsPerPage} registrations
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>

      {/* View Dialog */}
      <AlertDialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <AlertDialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader className="pb-4">
            <AlertDialogTitle className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Registration Details
            </AlertDialogTitle>
          </AlertDialogHeader>

          {selectedRegistration && (
            <div className="space-y-6">
              {/* Organizer Information */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-600" />
                    Organizer Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="font-medium">Full Name: {selectedRegistration.userId?.firstName || 'N/A'} {selectedRegistration.userId?.lastName || ''}</div>
                    <div className="font-medium">Email: {selectedRegistration.email || selectedRegistration.userId?.email || 'N/A'}</div>
                    <div className="font-medium">Phone: {selectedRegistration.phoneNumber || selectedRegistration.userId?.phoneNumber || 'N/A'}</div>
                    <div className="font-medium">Organization: {selectedRegistration.organization || 'N/A'}</div>
                    <div className="font-medium">Organizer Type: {selectedRegistration.organizerType || 'N/A'}</div>
                    <div className="font-medium">Other Type: {selectedRegistration.organizerTypeOther || 'N/A'}</div>
                    <div className="font-medium">Social Links: {selectedRegistration.socialLinks || 'N/A'}</div>
                  </div>
                  <div className="space-y-3">
                    {selectedRegistration.businessLicenseUrl ? (
                      (() => {
                        const url = selectedRegistration.businessLicenseUrl.startsWith('http')
                          ? selectedRegistration.businessLicenseUrl
                          : `${process.env.NEXT_PUBLIC_API_URL}${selectedRegistration.businessLicenseUrl}`;
                        return (
                          <div>
                            <span className="font-medium">Business License:</span>
                            <div className="mt-2">
                              <a href={url} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={url}
                                  alt="Business License"
                                  className="rounded border shadow max-w-xs max-h-40 object-contain hover:scale-105 transition-transform duration-200"
                                />
                              </a>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="font-medium">Business License: N/A</div>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Separator />

              {/* Business & Legal Details */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building className="h-5 w-5 text-amber-600" />
                    Business & Legal Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="font-medium">TIN Number: <span className="text-blue-600">{selectedRegistration.tinNumber || 'N/A'}</span></div>
                    <div className="font-medium">National ID Number: <span className="text-blue-600">{selectedRegistration.nationalIdNumber || 'N/A'}</span></div>
                    <div className="font-medium">Business Address: {selectedRegistration.businessAddress || 'N/A'}</div>
                    <div className="font-medium">Bank Account Holder: {selectedRegistration.bankAccountHolder || 'N/A'}</div>
                    <div className="font-medium">Contact Role: {selectedRegistration.contactRole || 'N/A'}</div>
                  </div>
                  <div className="space-y-3">
                    <div className="font-medium">Bank Name: {selectedRegistration.bankName || 'N/A'}</div>
                    <div className="font-medium">Bank Account Number: {selectedRegistration.bankAccountNumber || 'N/A'}</div>
                  </div>
                </CardContent>
              </Card>
              <Separator />

              {/* Event Profile */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-green-600" />
                    Event Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="font-medium">Has Organized Before: {selectedRegistration.hasOrganizedBefore || 'N/A'}</div>
                    <div className="font-medium">Event Kinds: {selectedRegistration.eventKinds?.join(', ') || 'N/A'}</div>
                    <div className="font-medium">Other Event Kind: {selectedRegistration.eventKindOther || 'N/A'}</div>
                    <div className="font-medium">Sample Event Name: {selectedRegistration.sampleEventName || 'N/A'}</div>
                    <div className="font-medium">Estimated Audience: {selectedRegistration.estimatedAudience || 'N/A'}</div>
                    <div className="font-medium">Event Frequency: {selectedRegistration.eventFrequency || 'N/A'}</div>
                  </div>
                  {/* <div className="space-y-3">
                    <div className="font-medium">Expected Attendees: {selectedRegistration.eventDetails?.expectedAttendees ?? 'N/A'}</div>
                    <div className="flex items-center gap-2 font-medium">Offer Promo: <span className={selectedRegistration.eventDetails?.offerPromo ? 'bg-green-100 text-green-700 px-2 py-1 rounded' : 'bg-gray-100 text-gray-700 px-2 py-1 rounded'}>{selectedRegistration.eventDetails?.offerPromo ? 'Yes' : 'No'}</span></div>
                    <div className="flex items-center gap-2 font-medium">Marketing Support: <span className={selectedRegistration.eventDetails?.marketingSupport ? 'bg-green-100 text-green-700 px-2 py-1 rounded' : 'bg-gray-100 text-gray-700 px-2 py-1 rounded'}>{selectedRegistration.eventDetails?.marketingSupport ? 'Yes' : 'No'}</span></div>
                    <div className="flex items-center gap-2 font-medium">Front Page Ad: <span className={selectedRegistration.eventDetails?.frontPageAd ? 'bg-green-100 text-green-700 px-2 py-1 rounded' : 'bg-gray-100 text-gray-700 px-2 py-1 rounded'}>{selectedRegistration.eventDetails?.frontPageAd ? 'Yes' : 'No'}</span></div>
                    <div className="flex items-center gap-2 font-medium">Onsite Support: <span className={selectedRegistration.eventDetails?.onsiteSupport ? 'bg-green-100 text-green-700 px-2 py-1 rounded' : 'bg-gray-100 text-gray-700 px-2 py-1 rounded'}>{selectedRegistration.eventDetails?.onsiteSupport ? 'Yes' : 'No'}</span></div>
                  </div> */}
                </CardContent>
              </Card>
              <Separator />

              {/* Platform Preferences */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    Platform Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="font-medium">Payout Method: {selectedRegistration.payoutMethod || 'N/A'}</div>
                    <div className="font-medium">Need Support: {selectedRegistration.needSupport || 'N/A'}</div>
                    <div className="font-medium">Use QR Scanner: {selectedRegistration.useQrScanner || 'N/A'}</div>
                  </div>
                </CardContent>
              </Card>
              <Separator />

              {/* Terms & Agreement */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    Terms & Agreement
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 font-medium">Agreed to Terms: <span className={selectedRegistration.agreeTerms ? 'bg-green-100 text-green-700 px-2 py-1 rounded' : 'bg-gray-100 text-gray-700 px-2 py-1 rounded'}>{selectedRegistration.agreeTerms ? 'Yes' : 'No'}</span></div>
                    <div className="flex items-center gap-2 font-medium">Agreed to Fee: <span className={selectedRegistration.agreeFee ? 'bg-green-100 text-green-700 px-2 py-1 rounded' : 'bg-gray-100 text-gray-700 px-2 py-1 rounded'}>{selectedRegistration.agreeFee ? 'Yes' : 'No'}</span></div>
                    <div className="flex items-center gap-2 font-medium">Digital Signature: <span className={selectedRegistration.digitalSignature ? 'bg-green-100 text-green-700 px-2 py-1 rounded' : 'bg-gray-100 text-gray-700 px-2 py-1 rounded'}>{selectedRegistration.digitalSignature ? 'Yes' : 'No'}</span></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Separator className="my-4" />

          <AlertDialogFooter>
            <AlertDialogCancel className="px-6">Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Action Dialog */}
      <AlertDialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'approve' ? 'Approve Registration' : 'Reject Registration'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'approve'
                ? 'Are you sure you want to approve this registration?'
                : 'Are you sure you want to reject this registration?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <label>Admin Notes</label>
              <Input
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add notes about this decision..."
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              className={actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {actionType === 'approve' ? 'Approve' : 'Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
} 