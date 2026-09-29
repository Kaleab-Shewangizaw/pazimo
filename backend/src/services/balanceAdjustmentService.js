const mongoose = require("mongoose");
const BalanceAdjustment = require("../models/BalanceAdjustment");

const EMPTY = { tickets: 0, beverages: 0, capital: 0 };

/**
 * One organizer's adjustment totals, by stream — added back into that
 * stream's available-balance formula wherever it's computed. See
 * BalanceAdjustment.js for why this exists.
 */
const getOrganizerAdjustments = async (organizerId, currency = "ETB") => {
  const rows = await BalanceAdjustment.aggregate([
    {
      $match: {
        organizer: new mongoose.Types.ObjectId(String(organizerId)),
        currency,
      },
    },
    { $group: { _id: "$stream", total: { $sum: "$amount" } } },
  ]);

  const byStream = { ...EMPTY };
  for (const row of rows) {
    if (row._id in byStream) byStream[row._id] = row.total;
  }
  return byStream;
};

/**
 * The same totals for a page of organizers in one query, for list views that
 * already assemble their response per-organizer from a handful of bulk
 * aggregations (see organizerOverviewController.js) rather than one query per
 * row.
 */
const getAdjustmentsByOrganizer = async (organizerIds, currency = "ETB") => {
  const rows = await BalanceAdjustment.aggregate([
    { $match: { organizer: { $in: organizerIds }, currency } },
    {
      $group: {
        _id: { organizer: "$organizer", stream: "$stream" },
        total: { $sum: "$amount" },
      },
    },
  ]);

  const byOrganizer = new Map();
  for (const row of rows) {
    const key = String(row._id.organizer);
    const entry = byOrganizer.get(key) || { ...EMPTY };
    if (row._id.stream in entry) entry[row._id.stream] = row.total;
    byOrganizer.set(key, entry);
  }
  return byOrganizer;
};

module.exports = { getOrganizerAdjustments, getAdjustmentsByOrganizer };
