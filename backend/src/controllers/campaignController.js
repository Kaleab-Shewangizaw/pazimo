const Campaign = require("../models/Campaign");
const { sendSMS } = require("../utils/sms");
const Payment = require("../models/Payment");
const PaymentConfig = require("../models/PaymentConfig");
const SantimPayService = require("../services/santimPayService");
const ChapaService = require("../services/chapaService");
const { v4: uuidv4 } = require("uuid");

exports.createDraft = async (req, res) => {
  try {
    const { campaignId, title, message, targetedEvents, recipients, price } =
      req.body;
    const organizerId = req.user.id;

    let campaign;
    if (campaignId) {
      campaign = await Campaign.findOne({ _id: campaignId, organizerId });
      if (!campaign) {
        // If ID provided but not found, maybe create new? Or error.
        // Assuming create new if not found is safer for drafts.
        campaign = new Campaign({ organizerId });
      }
    } else {
      campaign = new Campaign({ organizerId });
    }

    campaign.title = title || "Untitled";
    campaign.message = message;
    campaign.targetedEvents = targetedEvents || [];
    campaign.recipients = recipients || [];
    campaign.price = price || 0;
    campaign.totalRecipients = recipients ? recipients.length : 0;
    campaign.status = "draft";

    await campaign.save();

    res.status(200).json({ success: true, data: campaign });
  } catch (error) {
    console.error("Draft Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.finalizeCampaign = async (req, res) => {
  try {
    const {
      campaignId,
      title,
      message,
      targetedEvents,
      recipients,
      price,
      paymentId,
    } = req.body;
    const organizerId = req.user.id;

    // Security Check: Verify Payment
    if (price > 0) {
      if (!paymentId) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Payment required for paid campaigns",
          });
      }

      const payment = await Payment.findOne({ transactionId: paymentId });

      if (!payment) {
        return res
          .status(404)
          .json({ success: false, message: "Payment record not found" });
      }

      if (payment.status !== "PAID") {
        // Double check with provider if local status is lagging
        try {
          if (payment.provider === "chapa") {
            const response = await ChapaService.verify(paymentId);
            if (
              response.status === "success" &&
              response.data.status === "success"
            ) {
              payment.status = "PAID";
              await payment.save();
            } else {
              return res
                .status(402)
                .json({
                  success: false,
                  message: "Payment not verified (Chapa).",
                });
            }
          } else {
            // Santim Logic
            const providerData =
              await SantimPayService.checkTransactionStatus(paymentId);
            const providerStatus = (
              providerData.status ||
              providerData.paymentStatus ||
              ""
            ).toUpperCase();

            if (
              providerStatus === "COMPLETED" ||
              providerStatus === "SUCCESS"
            ) {
              payment.status = "PAID";
              await payment.save();
            } else {
              return res
                .status(402)
                .json({
                  success: false,
                  message: "Payment not verified. Status: " + providerStatus,
                });
            }
          }
        } catch (e) {
          return res
            .status(402)
            .json({
              success: false,
              message: "Payment verification failed. Please contact support.",
            });
        }
      }
    }

    // If reusing a draft
    let campaign;
    if (campaignId) {
      campaign = await Campaign.findOne({ _id: campaignId, organizerId });
    }

    if (!campaign) {
      campaign = new Campaign({ organizerId });
    }

    campaign.title = title;
    campaign.message = message;
    campaign.targetedEvents = targetedEvents || [];
    campaign.recipients = recipients || [];
    campaign.price = price;
    campaign.paymentId = paymentId;
    campaign.totalRecipients = recipients.length;
    campaign.status = "active"; // Processing

    await campaign.save();

    // Process SMS Sending (Async)
    processCampaignSMS(campaign);

    res
      .status(201)
      .json({
        success: true,
        data: campaign,
        message: "Campaign created and processing started",
      });
  } catch (error) {
    console.error("Campaign Creation Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCampaigns = async (req, res) => {
  try {
    const organizerId = req.user.id;
    const campaigns = await Campaign.find({ organizerId }).sort({
      createdAt: -1,
    });
    res.status(200).json({ success: true, data: campaigns });
  } catch (error) {
    console.error("Get Campaigns Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findOneAndDelete({
      _id: id,
      organizerId: req.user.id,
      status: "draft",
    });

    if (!campaign)
      return res
        .status(404)
        .json({
          success: false,
          message: "Draft not found or cannot delete active campaign",
        });

    res.status(200).json({ success: true, message: "Deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.initiatePayment = async (req, res) => {
  try {
    const {
      amount,
      paymentReason,
      phoneNumber,
      paymentMethod: reqPaymentMethod,
      campaignId,
    } = req.body;
    const userId = req.user ? req.user._id : null;

    // Check active payment provider
    const config = await PaymentConfig.findOne().sort({ createdAt: -1 });
    const activeProvider = config ? config.activeProvider : "SANTIM";

    const transactionId = uuidv4();

    if (activeProvider === "CHAPA") {
      const userEmail = req.user ? req.user.email : "guest@pazimo.com";
      const firstName = req.user
        ? req.user.firstName || req.user.name || "Guest"
        : "Guest";
      const lastName = req.user ? req.user.lastName || "User" : "User";
      const chapaMethod = (reqPaymentMethod || "telebirr").toLowerCase();

      // Format phone for Chapa (must start with 09 or 07, 10 digits)
      let chapaPhone = phoneNumber;
      if (chapaPhone.startsWith("251")) {
        chapaPhone = "0" + chapaPhone.slice(3);
      } else if (chapaPhone.startsWith("+251")) {
        chapaPhone = "0" + chapaPhone.slice(4);
      }

      // Chapa Direct Charge
      await ChapaService.directCharge({
        amount: amount.toString(),
        currency: "ETB",
        mobile: chapaPhone,
        type: chapaMethod, // telebirr, mpesa, etc (lowercase)
        email: userEmail,
        first_name: firstName,
        last_name: lastName,
        tx_ref: transactionId,
      });

      const payment = await Payment.create({
        transactionId,
        status: "PENDING",
        price: amount,
        userId,
        provider: "chapa",
        invitationType: "campaign",
        message: `Campaign Payment: ${campaignId || "New"}`,
        ticketDetails: { campaignId },
      });

      return res.status(200).json({
        success: true,
        message: "Payment initiated via Chapa",
        transactionId,
        payment,
        provider: "chapa",
      });
    }

    // Default: Santim
    const paymentMethod = reqPaymentMethod || "Telebirr";
    const notifyUrl = `${process.env.BACKEND_URL || "https://pazimoapp.testserveret.com"}/api/campaigns/webhook/santim`;

    // Initiate Direct Payment
    await SantimPayService.directPayment(
      transactionId,
      amount,
      paymentReason,
      notifyUrl,
      phoneNumber,
      paymentMethod,
    );

    // Save Payment Record
    const payment = await Payment.create({
      transactionId,
      status: "PENDING",
      price: amount,
      userId,
      provider: "santim",
      invitationType: "campaign",
      message: `Campaign Payment: ${campaignId || "New"}`,
      ticketDetails: {
        campaignId,
      },
    });

    res.status(200).json({
      success: true,
      message: "Payment initiated",
      transactionId,
      payment,
      provider: "santim",
    });
  } catch (error) {
    console.error("Initiate Campaign Payment Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: error.message || "Payment service unavailable",
      });
  }
};

exports.checkPaymentStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const payment = await Payment.findOne({ transactionId });

    if (!payment)
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });

    // Use service to verify if still pending (optional, here we trust DB or poll verify)
    if (payment.status !== "PAID") {
      if (payment.provider === "chapa") {
        try {
          const response = await ChapaService.verify(transactionId);
          if (
            response.status === "success" &&
            response.data.status === "success"
          ) {
            payment.status = "PAID";
            await payment.save();
          }
        } catch (e) {
          console.error("Chapa verify error", e.message);
        }
      } else {
        // Santim Logic
        // Already handled by webhook mostly, but could verify manually here if sdk supports
      }
    }

    res.status(200).json({ success: true, status: payment.status });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.santimWebhook = async (req, res) => {
  try {
    // Santim sends data in body or params? Usually body.
    // { thirdPartyId: transactionId, status: 'COMPLETED', ... }
    // Note: verify signature if needed.

    // This is a placeholder log. Actual santim payload structure is needed.
    // Assuming standard structure or just handling basic 'success'.
    console.log("Campaign Webhook:", req.body);

    // The implementation depends on exact Santim payload.
    // Based on logic in generic webhook:
    const { thirdPartyId, Status } = req.body; // Example

    if (Status === "COMPLETED" || Status === "SUCCESS") {
      await Payment.findOneAndUpdate(
        { transactionId: thirdPartyId },
        { status: "PAID" },
      );
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).send("Error");
  }
};

async function processCampaignSMS(campaign) {
  try {
    console.log(
      `Starting SMS blast for Campaign ${campaign._id} (${campaign.recipients.length} recipients)`,
    );

    let successCount = 0;
    for (const recipient of campaign.recipients) {
      if (recipient.phone) {
        // Rate limit/Delay could be here
        const res = await sendSMS(recipient.phone, campaign.message);
        if (res.success) successCount++;
      }
    }

    campaign.status = "completed";
    // You might want to store delivery stats
    await campaign.save();
    console.log(
      `Campaign ${campaign._id} completed. ${successCount}/${campaign.recipients.length} sent.`,
    );
  } catch (err) {
    console.error("SMS Blast Error:", err);
    campaign.status = "failed"; // or partial
    await campaign.save();
  }
}
