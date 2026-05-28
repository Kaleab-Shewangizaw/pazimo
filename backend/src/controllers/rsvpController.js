const { StatusCodes } = require("http-status-codes");
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const RsvpForm = require("../models/RsvpForm");
const RsvpResponse = require("../models/RsvpResponse");

const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");

const buildShareUrl = (form) =>
  `${FRONTEND_URL}/${form.type === "rsvp" ? "rsvp-form" : "review-form"}/${form.publicId}`;

const sanitizePublicForm = (form) => {
  const { organizerId, __v, ...publicForm } = form;
  return publicForm;
};

const hasAdminAccess = (user) => user?.role === "admin";

const normalizeSections = (sections = []) =>
  sections.map((section, index) => ({
    id: section.id || uuidv4(),
    title: section.title || `Section ${index + 1}`,
    order: Number.isFinite(section.order) ? section.order : index,
  }));

const normalizeQuestions = (questions = []) =>
  questions.map((question, index) => ({
    id: question.id || uuidv4(),
    label: question.label || "Untitled question",
    type: question.type,
    required: !!question.required,
    options: Array.isArray(question.options) ? question.options.filter(Boolean) : [],
    conditional: question.conditional
      ? {
          questionId: question.conditional.questionId,
          operator: question.conditional.operator,
          value: Number(question.conditional.value),
        }
      : undefined,
    sectionId: question.sectionId,
    order: Number.isFinite(question.order) ? question.order : index,
  }));

const buildFormPayload = (body = {}) => ({
  title: body.title,
  description: body.description || "",
  type: body.type === "review" ? "review" : "rsvp",
  status: body.status || "draft",
  coverImage: body.coverImage || "",
  date: body.date || "",
  hostedBy: body.hostedBy || "",
  startTime: body.startTime || "",
  endTime: body.endTime || "",
  location: body.location || "",
  venue: body.venue || "",
  rsvpLimit:
    body.rsvpLimit === undefined ||
    body.rsvpLimit === null ||
    body.rsvpLimit === ""
      ? undefined
      : Number(body.rsvpLimit),
  approvalMode: body.approvalMode || "auto",
  payment: body.payment
    ? {
        enabled: !!body.payment.enabled,
        price: Number(body.payment.price || 0),
        currency: body.payment.currency || "USD",
        deadline: body.payment.deadline || undefined,
      }
    : undefined,
  anonymous: !!body.anonymous,
  sections: normalizeSections(Array.isArray(body.sections) ? body.sections : []),
  questions: normalizeQuestions(Array.isArray(body.questions) ? body.questions : []),
});

const toFormResponse = async (form) => ({
  ...form.toObject(),
  responseCount:
    form.responseCount ?? (await RsvpResponse.countDocuments({ formId: form._id })),
  shareUrl: buildShareUrl(form),
});

const applyStatusLifecycle = (form, nextStatus) => {
  const status = nextStatus || form.status || "draft";
  form.status = status;
  form.isClosed = ["cancelled", "archived", "closed"].includes(status);
  if (status === "published") {
    form.isPublic = true;
  }
  if (["cancelled", "archived", "closed"].includes(status)) {
    form.isPublic = false;
  }

  if (status === "published" && !form.publishedAt) {
    form.publishedAt = new Date();
  }

  if (status === "cancelled" && !form.cancelledAt) {
    form.cancelledAt = new Date();
  }

  if (status === "archived" && !form.archivedAt) {
    form.archivedAt = new Date();
  }

  if (status === "hidden") {
    form.isPublic = false;
  }

  return form;
};

const assertFormOwnership = async (formId, user) => {
  const query = {};

  if (!hasAdminAccess(user)) {
    if (!mongoose.Types.ObjectId.isValid(user?._id)) return null;
    query.organizerId = user._id;
  }
  
  if (mongoose.Types.ObjectId.isValid(formId)) {
    query.$or = [{ _id: formId }, { publicId: formId }, { formId: formId }];
  } else {
    query.$or = [{ publicId: formId }, { formId: formId }];
  }

  query.isDeleted = { $ne: true };
  query.deletedAt = null;
  
  return RsvpForm.findOne(query);
};

const createForm = async (req, res) => {
  try {
    const payload = buildFormPayload(req.body);

    if (!payload.title || !payload.title.trim()) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Form title is required",
      });
    }

    if (!req.user?._id) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const form = await RsvpForm.create({
      ...payload,
      title: payload.title.trim(),
      organizerId: req.user._id,
      slug: req.body.slug || undefined,
      status: payload.status === "published" ? "published" : "draft",
      publishedAt: payload.status === "published" ? new Date() : undefined,
      isPublic: payload.status === "published",
      isClosed: false,
      isDeleted: false,
      deletedAt: null,
      responseCount: 0,
      viewCount: 0,
    });

    return res.status(StatusCodes.CREATED).json({
      success: true,
      data: await toFormResponse(form),
    });
  } catch (error) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

const listForms = async (req, res) => {
  try {
    const query = hasAdminAccess(req.user) ? {} : { organizerId: req.user._id };
    if (req.query.type) query.type = req.query.type;
    if (req.query.status) query.status = req.query.status;
    if (req.query.approvalMode) query.approvalMode = req.query.approvalMode;
    query.isDeleted = { $ne: true };
    query.deletedAt = null;

    const forms = await RsvpForm.find(query).sort({ updatedAt: -1 }).lean();

    const formsWithCounts = await Promise.all(
      forms.map(async (form) => {
        const responseCount = form.responseCount ?? (await RsvpResponse.countDocuments({ formId: form._id }));
        return { ...form, shareUrl: buildShareUrl(form), responseCount };
      })
    );
    
    return res.json({
      success: true,
      data: formsWithCounts,
    });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const listPublishedForms = async (req, res) => {
  try {
    const query = { status: "published", isPublic: true, isDeleted: { $ne: true }, deletedAt: null };
    if (req.query.type) query.type = req.query.type;

    const requestedLimit = Number(req.query.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 50)
      : 6;

    const forms = await RsvpForm.find(query)
      .sort({ publishedAt: -1, updatedAt: -1 })
      .limit(limit)
      .lean();

    const formsWithCounts = await Promise.all(
      forms.map(async (form) => {
        const responseCount = form.responseCount ?? (await RsvpResponse.countDocuments({ formId: form._id }));
        return { ...sanitizePublicForm(form), shareUrl: buildShareUrl(form), responseCount };
      })
    );

    return res.json({
      success: true,
      data: formsWithCounts,
    });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const getForm = async (req, res) => {
  try {
    const form = await assertFormOwnership(req.params.id, req.user);
    if (!form) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Form not found",
      });
    }

    form.viewCount = (form.viewCount || 0) + 1;
    await form.save();

    const responseCount = form.responseCount ?? (await RsvpResponse.countDocuments({ formId: form._id }));

    return res.json({
      success: true,
      data: { ...form.toObject(), shareUrl: buildShareUrl(form), responseCount },
    });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const updateForm = async (req, res) => {
  try {
    const form = await assertFormOwnership(req.params.id, req.user);
    if (!form) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Form not found",
      });
    }

    const payload = buildFormPayload(req.body);
    const nextStatus = req.body.status || form.status;
    Object.assign(form, {
      ...payload,
      title: payload.title ? payload.title.trim() : form.title,
    });

    applyStatusLifecycle(form, nextStatus);

    await form.save();

    return res.json({
      success: true,
      data: await toFormResponse(form),
    });
  } catch (error) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

const uploadCoverImage = async (req, res) => {
  try {
    const form = await assertFormOwnership(req.params.id, req.user);
    if (!form) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Form not found",
      });
    }

    if (!req.file) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Cover image file is required",
      });
    }

    form.coverImage = `/uploads/${req.file.filename}`;
    await form.save();

    return res.json({
      success: true,
      data: await toFormResponse(form),
    });
  } catch (error) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteForm = async (req, res) => {
  try {
    const form = await assertFormOwnership(req.params.id, req.user);
    if (!form) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Form not found",
      });
    }

    form.isDeleted = true;
    form.deletedAt = new Date();
    form.isPublic = false;
    form.isClosed = true;
    form.status = "archived";
    await form.save();

    return res.json({
      success: true,
      message: "Form deleted",
      data: await toFormResponse(form),
    });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const duplicateForm = async (req, res) => {
  try {
    const form = await assertFormOwnership(req.params.id, req.user);
    if (!form) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Form not found",
      });
    }

    const source = form.toObject();
    const copy = await RsvpForm.create({
      organizerId: form.organizerId,
      title: `${form.title} (Copy)`,
      description: source.description || "",
      type: source.type,
      status: "draft",
      coverImage: source.coverImage || "",
      date: source.date || "",
      hostedBy: source.hostedBy || "",
      startTime: source.startTime || "",
      endTime: source.endTime || "",
      location: source.location || "",
      venue: source.venue || "",
      rsvpLimit: source.rsvpLimit,
      approvalMode: source.approvalMode || "auto",
      payment: source.payment,
      anonymous: !!source.anonymous,
      sections: Array.isArray(source.sections) ? source.sections : [],
      questions: Array.isArray(source.questions) ? source.questions : [],
      status: "draft",
      isFeatured: false,
      isTrending: false,
      bannerStatus: false,
      isPublic: false,
      isClosed: false,
      isDeleted: false,
      deletedAt: null,
    });

    return res.status(StatusCodes.CREATED).json({
      success: true,
      data: await toFormResponse(copy),
    });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const publishForm = async (req, res) => {
  try {
    const form = await assertFormOwnership(req.params.id, req.user);
    if (!form) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Form not found",
      });
    }

    applyStatusLifecycle(form, "published");
    form.isPublic = true;
    form.isClosed = false;
    await form.save();

    return res.json({
      success: true,
      data: await toFormResponse(form),
    });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const getFormByPublicId = async (req, res) => {
  try {
    const form = await RsvpForm.findOne({
      publicId: req.params.publicId,
      status: "published",
      isPublic: true,
      isDeleted: { $ne: true },
      deletedAt: null,
    }).lean();
    if (!form) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Form not found",
      });
    }

    return res.json({
      success: true,
      data: { ...sanitizePublicForm(form), shareUrl: buildShareUrl(form) },
    });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const submitResponse = async (req, res) => {
  try {
    const form = await RsvpForm.findOne({
      publicId: req.params.publicId,
    });
    if (!form) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Form not found",
      });
    }
    
    if (form.isDeleted || form.deletedAt) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Form is not available for responses",
      });
    }

    if (!["published", "draft"].includes(form.status) || form.isPublic === false) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Form is not available for responses",
      });
    }

    const { answers, tag, metadata = {}, attendee = {} } = req.body || {};
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Answers are required",
      });
    }

    const previewBypass = metadata?.preview === true;
    if (form.type === "rsvp" && !previewBypass) {
      const fullName = String(attendee?.fullName || "").trim();
      const email = String(attendee?.email || "").trim().toLowerCase();
      const phone = String(attendee?.phone || "").trim();

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^\+?[0-9][0-9\s().-]{6,}$/;

      if (!fullName) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: "Full name is required",
        });
      }
      if (!email || !emailRegex.test(email)) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: "A valid email address is required",
        });
      }
      if (!phone || !phoneRegex.test(phone)) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: "A valid phone number is required",
        });
      }
    }

    const responseStatus =
      form.type === "review"
          ? "approved"
          : form.payment?.enabled
            ? "unpaid"
            : form.approvalMode === "manual"
              ? "pending"
              : "approved";

    const response = await RsvpResponse.create({
      formId: form._id,
      formPublicId: form.publicId,
      organizerId: form.organizerId,
      answers,
      attendee: {
        fullName: String(attendee?.fullName || "").trim(),
        email: String(attendee?.email || "").trim().toLowerCase(),
        phone: String(attendee?.phone || "").trim(),
      },
      status: responseStatus,
      tag: tag && ["VIP", "Guest", "Press"].includes(tag) ? tag : "Guest",
      metadata: {
        userAgent: metadata.userAgent || req.headers["user-agent"] || "",
        ip: metadata.ip || req.ip || "",
        referrer: metadata.referrer || req.headers.referer || "",
        sourceUrl: metadata.sourceUrl || req.body.sourceUrl || "",
      },
      submittedAt: new Date(),
    });

    await RsvpForm.updateOne({ _id: form._id }, { $inc: { responseCount: 1 } });

    return res.status(StatusCodes.CREATED).json({
      success: true,
      data: response.toObject(),
    });
  } catch (error) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

const listResponses = async (req, res) => {
  try {
    const form = await assertFormOwnership(req.params.id, req.user);
    if (!form) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Form not found",
      });
    }

    const responses = await RsvpResponse.find({ formId: form._id })
      .sort({ createdAt: -1 })
      .lean();
    return res.json({
      success: true,
      data: responses,
    });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const updateResponseTag = async (req, res) => {
  try {
    const form = await assertFormOwnership(req.params.id, req.user);
    if (!form) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Form not found",
      });
    }

    const tag = req.body.tag;
    if (!["VIP", "Guest", "Press"].includes(tag)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Invalid tag",
      });
    }

    const response = await RsvpResponse.findOneAndUpdate(
      { _id: req.params.responseId, formId: form._id },
      { tag },
      { new: true }
    );

    if (!response) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Response not found",
      });
    }

    return res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const updateResponseStatus = async (req, res) => {
  try {
    const form = await assertFormOwnership(req.params.id, req.user);
    if (!form) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Form not found",
      });
    }

    const status = req.body.status;
    if (!["pending", "approved", "paid", "unpaid", "rejected"].includes(status)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Invalid status",
      });
    }

    const response = await RsvpResponse.findOneAndUpdate(
      { _id: req.params.responseId, formId: form._id },
      { status },
      { new: true }
    );

    if (!response) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Response not found",
      });
    }

    return res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const getAnalytics = async (req, res) => {
  try {
    const form = await assertFormOwnership(req.params.id, req.user);
    if (!form) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Form not found",
      });
    }

    const responses = await RsvpResponse.find({ formId: form._id }).lean();
    const total = responses.length;
    const approved = responses.filter((response) => ["approved", "paid"].includes(response.status)).length;
    const pending = responses.filter((response) => response.status === "pending").length;
    const paid = responses.filter((response) => response.status === "paid").length;
    const unpaid = responses.filter((response) => response.status === "unpaid").length;

    let avgRating = null;
    let nps = null;
    let topKeywords = [];

    if (form.type === "review") {
      const ratingQuestion = form.questions.find((question) => question.type === "rating");
      const npsQuestion = form.questions.find((question) => question.type === "nps");
      const ratings = ratingQuestion
        ? responses.map((response) => response.answers?.[ratingQuestion.id]).filter((value) => typeof value === "number")
        : [];
      if (ratings.length > 0) {
        avgRating = Number((ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1));
      }

      const npsValues = npsQuestion
        ? responses.map((response) => response.answers?.[npsQuestion.id]).filter((value) => typeof value === "number")
        : [];
      if (npsValues.length > 0) {
        const promoters = npsValues.filter((value) => value >= 9).length;
        const detractors = npsValues.filter((value) => value <= 6).length;
        nps = Math.round(((promoters - detractors) / npsValues.length) * 100);
      }

      const longTextIds = form.questions.filter((question) => question.type === "long_text").map((question) => question.id);
      const allWords = [];
      responses.forEach((response) => {
        longTextIds.forEach((questionId) => {
          const value = response.answers?.[questionId];
          if (typeof value === "string") {
            allWords.push(...value.toLowerCase().split(/\W+/).filter((word) => word.length > 3));
          }
        });
      });
      const counts = {};
      allWords.forEach((word) => {
        counts[word] = (counts[word] || 0) + 1;
      });
      topKeywords = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    }

    return res.json({
      success: true,
      data: {
        total,
        approved,
        pending,
        paid,
        unpaid,
        dropOff: total === 0 ? 0 : Math.round((unpaid / total) * 100),
        avgRating,
        nps,
        topKeywords,
      },
    });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const cancelForm = async (req, res) => {
  try {
    const form = await assertFormOwnership(req.params.id, req.user);
    if (!form) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Form not found",
      });
    }

    applyStatusLifecycle(form, "cancelled");
    await form.save();

    return res.json({ success: true, data: await toFormResponse(form) });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

const archiveForm = async (req, res) => {
  try {
    const form = await assertFormOwnership(req.params.id, req.user);
    if (!form) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Form not found",
      });
    }

    applyStatusLifecycle(form, "archived");
    await form.save();

    return res.json({ success: true, data: await toFormResponse(form) });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

const toggleVisibilityForm = async (req, res) => {
  try {
    const form = await assertFormOwnership(req.params.id, req.user);
    if (!form) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Form not found",
      });
    }

    form.isPublic = typeof req.body.isPublic === "boolean" ? req.body.isPublic : !form.isPublic;
    if (form.isPublic && form.status === "hidden") {
      form.status = "published";
    }

    await form.save();
    return res.json({ success: true, data: await toFormResponse(form) });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

const toggleFeaturedForm = async (req, res) => {
  try {
    const form = await assertFormOwnership(req.params.id, req.user);
    if (!form) {
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: "Form not found" });
    }

    form.isFeatured = typeof req.body.isFeatured === "boolean" ? req.body.isFeatured : !form.isFeatured;
    await form.save();
    return res.json({ success: true, data: await toFormResponse(form) });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

const toggleTrendingForm = async (req, res) => {
  try {
    const form = await assertFormOwnership(req.params.id, req.user);
    if (!form) {
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: "Form not found" });
    }

    form.isTrending = typeof req.body.isTrending === "boolean" ? req.body.isTrending : !form.isTrending;
    await form.save();
    return res.json({ success: true, data: await toFormResponse(form) });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

const toggleBannerForm = async (req, res) => {
  try {
    const form = await assertFormOwnership(req.params.id, req.user);
    if (!form) {
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: "Form not found" });
    }

    form.bannerStatus = typeof req.body.bannerStatus === "boolean" ? req.body.bannerStatus : !form.bannerStatus;
    await form.save();
    return res.json({ success: true, data: await toFormResponse(form) });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

module.exports = {
  createForm,
  listForms,
  listPublishedForms,
  getForm,
  updateForm,
  uploadCoverImage,
  deleteForm,
  duplicateForm,
  publishForm,
  cancelForm,
  archiveForm,
  toggleVisibilityForm,
  toggleFeaturedForm,
  toggleTrendingForm,
  toggleBannerForm,
  getFormByPublicId,
  submitResponse,
  listResponses,
  updateResponseTag,
  updateResponseStatus,
  getAnalytics,
};