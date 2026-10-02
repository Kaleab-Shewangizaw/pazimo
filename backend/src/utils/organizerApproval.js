const OrganizerRegistration = require("../models/OrganizerRegistration");

// What makes an account a real organizer. `role: "organizer"` alone does NOT:
// POST /api/organizers/sign-up stamps that role on the account the moment
// someone applies, long before an admin has looked at anything. An organizer
// is an account whose OrganizerRegistration has been approved by an admin —
// that application is the record of the materials they submitted, and the
// admin's approval of them is the only thing that should grant the role's
// powers or put the account on any "organizers" list.
//
// Found 2026-10-01: every admin organizer list matched on role alone, so
// every pending and rejected applicant showed up beside the approved ones.

// The materials an application must carry before it can be submitted or
// approved. Mirrors exactly what the web sign-up form
// (frontend/app/organizer-registration/register/page.tsx) already marks as
// required, so the form keeps working unchanged — the difference is that the
// server now enforces it too, instead of trusting the browser. Business
// license and TIN stay optional on purpose: the form treats them as optional.
const REQUIRED_MATERIALS = [
  ["nationalIdNumber", "National ID number"],
  ["organization", "Organization/brand name"],
  ["organizerType", "Organizer type"],
  ["businessAddress", "Business address"],
  ["bankAccountHolder", "Bank account holder"],
  ["bankName", "Bank name"],
  ["bankAccountNumber", "Bank account number"],
  ["contactRole", "Primary contact person's role"],
];

const REQUIRED_AGREEMENTS = [
  ["agreeTerms", "Agreement to the terms and conditions"],
  ["agreeFee", "Agreement to the service fee"],
  ["digitalSignature", "Confirmation that the information is accurate"],
];

const isBlank = (value) =>
  value === undefined || value === null || String(value).trim() === "";

const isTrue = (value) => value === true || value === "true";

// Returns the human-readable labels of everything missing from an application
// (a registration document, or the raw sign-up body using the same field
// names). Empty array means complete.
const getMissingMaterials = (application) => {
  const missing = [];
  for (const [field, label] of REQUIRED_MATERIALS) {
    if (isBlank(application[field])) missing.push(label);
  }
  if (application.organizerType === "Other" && isBlank(application.organizerTypeOther)) {
    missing.push("Organizer type (other)");
  }
  for (const [field, label] of REQUIRED_AGREEMENTS) {
    if (!isTrue(application[field])) missing.push(label);
  }
  return missing;
};

const isOrganizerApproved = async (userId) =>
  Boolean(await OrganizerRegistration.exists({ userId, status: "approved" }));

// Ids of every account with an approved application — for narrowing an
// organizer listing's `{ role: "organizer" }` filter down to real organizers.
const getApprovedOrganizerIds = () =>
  OrganizerRegistration.distinct("userId", { status: "approved" });

// Narrows a `{ role: "organizer" }` User filter to approved organizers. When
// the filter already carries an `_id: { $in }` or `_id: { $nin }` (e.g. an
// eligibility tab), combines with it instead of overwriting it.
const restrictToApprovedOrganizers = async (query) => {
  const approvedIds = await getApprovedOrganizerIds();
  if (query._id && Array.isArray(query._id.$in)) {
    const approved = new Set(approvedIds.map(String));
    query._id = { $in: query._id.$in.filter((id) => approved.has(String(id))) };
  } else if (query._id && Array.isArray(query._id.$nin)) {
    const excluded = new Set(query._id.$nin.map(String));
    query._id = { $in: approvedIds.filter((id) => !excluded.has(String(id))) };
  } else {
    query._id = { $in: approvedIds };
  }
  return query;
};

module.exports = {
  getMissingMaterials,
  isOrganizerApproved,
  getApprovedOrganizerIds,
  restrictToApprovedOrganizers,
};
