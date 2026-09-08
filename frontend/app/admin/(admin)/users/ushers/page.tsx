"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, ArrowLeft } from "lucide-react"
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
import { useAdminAuthStore } from "@/store/adminAuthStore"

interface UsherData {
  _id: string
  firstName: string
  lastName?: string
  email: string
  phoneNumber: string
  isActive: boolean
  createdAt: string
}

// Ushers are door-staff accounts: role="usher" User docs an admin creates
// here (see /admin/users/ushers/add, POST /api/ushers). They don't own
// events — an organizer or admin separately generates a per-event code
// (event detail/edit page's "Usher Access" card) that any usher redeems in
// the Pazimo Organizer mobile app to unlock scanning for that one event.
export default function UshersPage() {
  const router = useRouter()
  const { token } = useAdminAuthStore()
  const [ushers, setUshers] = useState<UsherData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [usherToDelete, setUsherToDelete] = useState<string | null>(null)

  useEffect(() => {
    fetchUshers()
  }, [])

  const fetchUshers = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/users?role=usher&limit=200`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "Failed to fetch ushers")
      setUshers(data.data?.users || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch ushers")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = (id: string) => {
    setUsherToDelete(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!usherToDelete) return
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/users/${usherToDelete}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "Failed to delete usher")
      toast.success("Usher removed")
      fetchUshers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete usher")
    } finally {
      setDeleteDialogOpen(false)
      setUsherToDelete(null)
    }
  }

  return (
    <div className="container mx-auto py-10 p-4 sm:p-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-8">
        <div>
          <Button variant="ghost" size="sm" onClick={() => router.push("/admin/users")} className="mb-2 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            All Users
          </Button>
          <h1 className="text-3xl font-bold">Ushers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Door-staff accounts. Give a login here, then generate a code on an
            event's page for them to redeem in the mobile app.
          </p>
        </div>
        <Button onClick={() => router.push("/admin/users/ushers/add")}>
          <Plus className="h-4 w-4 mr-2" />
          Add Usher
        </Button>
      </div>

      {error ? (
        <div className="text-center py-10">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={fetchUshers}>Try Again</Button>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Loading ushers…
                  </TableCell>
                </TableRow>
              ) : ushers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No ushers yet.
                  </TableCell>
                </TableRow>
              ) : (
                ushers.map((usher) => (
                  <TableRow key={usher._id}>
                    <TableCell className="font-medium">
                      {usher.firstName} {usher.lastName || ""}
                    </TableCell>
                    <TableCell>{usher.email}</TableCell>
                    <TableCell>{usher.phoneNumber}</TableCell>
                    <TableCell>
                      <Badge variant={usher.isActive ? "secondary" : "destructive"}>
                        {usher.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(usher._id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this usher?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes their login entirely. Any event access they hold
              stays on record but they will no longer be able to sign in or scan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
