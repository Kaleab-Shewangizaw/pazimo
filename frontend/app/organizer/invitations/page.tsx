"use client";

import React, { useEffect } from "react";
import { useInvitationPage } from "@/hooks/useInvitationPage";
import PageHeader from "@/components/invitations/PageHeader";
import StatsOverview from "@/components/invitations/StatsOverview";
import EventsTable from "@/components/invitations/EventsTable";
import SentInvitationsTable from "@/components/invitations/SentInvitationsTable";
import PaginationControls from "@/components/invitations/PaginationControls";
import InviteModal from "@/components/invitations/InviteModal";
import InvitationDetailsModal from "@/components/invitations/InvitationDetailsModal";
import EventDetailsModal from "@/components/invitations/EventDetailsModal";
import AttendeesModal from "@/components/invitations/AttendeesModal";
import PaymentModal from "@/components/invitations/PaymentModal";
import QRModal from "@/components/QRModal";
import BulkInvite from "@/components/bulkInviteModel";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { processInvitation } from "@/lib/invitationUtils";

export default function InvitationsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    // State
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    attendeesPage,
    setAttendeesPage,
    attendeesPerPage,

    // Data
    events,
    sentInvitations,
    attendees,
    filteredEvents,
    filteredInvitations,
    totalPages,
    isLoading,

    // Modal States
    showInviteModal,
    setShowInviteModal,
    showDetailsModal,
    setShowDetailsModal,
    showEventDetailsModal,
    setShowEventDetailsModal,
    showAttendeesModal,
    setShowAttendeesModal,
    showPaymentModal,
    setShowPaymentModal,
    showQRModal,
    setShowQRModal,
    showBulkModal,
    setShowBulkModal,

    // Selected Items
    selectedEvent,
    selectedInvitation,

    // Form State
    contact,
    setContact,
    customerName,
    setCustomerName,
    message,
    setMessage,
    qrCodeCount,
    setQrCodeCount,
    guestType,
    setGuestType,
    contactType,
    setContactType,
    isSubmitting,

    // Handlers
    handleEventSelect,
    handleSendInvite,
    handleViewDetails,
    handleViewEventDetails,
    handleViewAttendees,
    handleViewQR,
    handleBulkInviteClick,
    handleSantimPayment,
    processPendingInvitation,

    // Stats
    stats,
    pricing,
    pendingInvitation,
    isSantimLoading,
  } = useInvitationPage();

  useEffect(() => {
    const action = searchParams.get("action");
    const orderId = searchParams.get("orderId") || searchParams.get("txn");
    const status = searchParams.get("status");

    if (action && orderId && status === "success") {
      const handlePaymentReturn = async () => {
        // Clear params immediately to prevent re-run
        router.replace("/organizer/invitations");

        if (action === "process_payment") {
          toast.info("Payment successful! Sending invitation...");
          const storedInvitation = localStorage.getItem(
            `invitation_${orderId}`
          );
          if (storedInvitation) {
            try {
              const invitationData = JSON.parse(storedInvitation);
              const success = await processInvitation(invitationData);
              if (success) {
                toast.success("Invitation sent successfully!");
              } else {
                toast.error("Failed to send invitation.");
              }
              localStorage.removeItem(`invitation_${orderId}`);
            } catch (e) {
              console.error("Failed to process invitation", e);
              toast.error("Error processing invitation.");
            }
          }
        } else if (action === "process_bulk_payment") {
          toast.info("Payment successful! Processing bulk invitations...");
          const storedIds = localStorage.getItem(`bulk_invitations_${orderId}`);
          if (storedIds) {
            try {
              const ids = JSON.parse(storedIds);
              const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/invitations/process-paid`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                  },
                  body: JSON.stringify({ invitationIds: ids }),
                }
              );
              const result = await response.json();
              if (response.ok && result.success) {
                toast.success(
                  `Successfully sent ${result.data.success.length} invitations!`
                );
              } else {
                toast.error(result.message || "Failed to send invitations.");
              }
              localStorage.removeItem(`bulk_invitations_${orderId}`);
            } catch (e) {
              console.error("Failed to process bulk invitations", e);
              toast.error("Error processing bulk invitations.");
            }
          }
        }
      };

      handlePaymentReturn();
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 space-y-6">
      <StatsOverview stats={stats} />
      <PageHeader activeTab={activeTab} setActiveTab={setActiveTab} />

      {activeTab === "send" ? (
        <EventsTable
          events={filteredEvents}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSelectEvent={handleEventSelect}
          onViewDetails={handleViewEventDetails}
          onViewAttendees={handleViewAttendees}
          onBulkInviteClick={handleBulkInviteClick}
          isLoading={isLoading}
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
        />
      ) : (
        <SentInvitationsTable
          invitations={filteredInvitations}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onViewDetails={handleViewDetails}
          isLoading={isLoading}
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
        />
      )}

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        totalItems={
          activeTab === "send"
            ? filteredEvents.length
            : filteredInvitations.length
        }
        itemsPerPage={itemsPerPage}
      />

      {/* Modals */}
      {showInviteModal && selectedEvent && (
        <InviteModal
          selectedEvent={selectedEvent}
          contact={contact}
          setContact={setContact}
          customerName={customerName}
          setCustomerName={setCustomerName}
          message={message}
          setMessage={setMessage}
          qrCodeCount={qrCodeCount}
          setQrCodeCount={setQrCodeCount}
          guestType={guestType}
          setGuestType={setGuestType}
          contactType={contactType}
          setContactType={setContactType}
          isSubmitting={isSubmitting}
          onSend={handleSendInvite}
          onClose={() => setShowInviteModal(false)}
          pricing={pricing}
        />
      )}

      {showDetailsModal && selectedInvitation && (
        <InvitationDetailsModal
          onClose={() => setShowDetailsModal(false)}
          invitation={selectedInvitation}
          onViewQR={() => {
            setShowDetailsModal(false);
            handleViewQR(selectedInvitation);
          }}
        />
      )}

      {showEventDetailsModal && selectedEvent && (
        <EventDetailsModal
          onClose={() => setShowEventDetailsModal(false)}
          event={selectedEvent}
        />
      )}

      {showAttendeesModal && selectedEvent && (
        <AttendeesModal
          selectedEvent={selectedEvent}
          attendees={attendees}
          attendeesPage={attendeesPage}
          setAttendeesPage={setAttendeesPage}
          attendeesPerPage={attendeesPerPage}
          onClose={() => setShowAttendeesModal(false)}
        />
      )}

      {showPaymentModal && pendingInvitation && (
        <PaymentModal
          pendingInvitation={pendingInvitation}
          pricing={pricing}
          isSantimLoading={isSantimLoading}
          onPay={handleSantimPayment}
          onCancel={() => setShowPaymentModal(false)}
        />
      )}

      {showQRModal && selectedInvitation && (
        <QRModal
          invitation={selectedInvitation}
          onClose={() => setShowQRModal(false)}
        />
      )}

      {showBulkModal && selectedEvent && (
        <BulkInvite event={selectedEvent} setShowBulkModal={setShowBulkModal} />
      )}
    </div>
  );
}
