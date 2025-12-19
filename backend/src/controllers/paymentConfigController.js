const PaymentConfig = require("../models/PaymentConfig");
const { StatusCodes } = require("http-status-codes");

const getActiveProvider = async (req, res) => {
  try {
    let config = await PaymentConfig.findOne();

    // If no config exists, create default
    if (!config) {
      config = await PaymentConfig.create({ activeProvider: "CHAPA" });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        activeProvider: config.activeProvider,
      },
    });
  } catch (error) {
    console.error("Error fetching payment config:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to fetch payment configuration",
    });
  }
};

const updateActiveProvider = async (req, res) => {
  try {
    const { provider } = req.body;

    if (!["CHAPA", "SANTIM"].includes(provider)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Invalid provider. Must be CHAPA or SANTIM",
      });
    }

    let config = await PaymentConfig.findOne();

    if (!config) {
      config = new PaymentConfig({ activeProvider: provider });
    } else {
      config.activeProvider = provider;
    }

    if (req.user) {
      config.updatedBy = req.user.userId;
    }

    await config.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Payment provider updated to ${provider}`,
      data: {
        activeProvider: config.activeProvider,
      },
    });
  } catch (error) {
    console.error("Error updating payment config:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update payment configuration",
    });
  }
};

module.exports = {
  getActiveProvider,
  updateActiveProvider,
};
