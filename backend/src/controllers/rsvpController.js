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

const assertFormOwnership = async (formId, organizerId) => {
  if (!mongoose.Types.ObjectId.isValid(organizerId)) return null;
  const query = { organizerId };
  
  if (mongoose.Types.ObjectId.isValid(formId)) {
    query.$or = [{ _id: formId }, { publicId: formId }, { formId: formId }];
  } else {
    query.$or = [{ publicId: formId }, { formId: formId }];
  }
  
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
    });

    return res.status(StatusCodes.CREATED).json({
      success: true,
      data: {
        ...form.toObject(),
        shareUrl: buildShareUrl(form),
      },
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
    const query = { organizerId: req.user._id };
    if (req.query.type) query.type = req.query.type;

    const forms = await RsvpForm.find(query).sort({ updatedAt: -1 }).lean();
    
    // Get response counts for all forms
    const formsWithCounts = await Promise.all(
      forms.map(async (form) => {
        const responseCount = await RsvpResponse.countDocuments({ formId: form._id });
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

const getForm = async (req, res) => {
  try {
    const form = await assertFormOwnership(req.params.id, req.user._id);
    if (!form) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Form not found",
      });
    }

    // Calculate response count
    const responseCount = await RsvpResponse.countDocuments({ formId: form._id });

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
    const form = await assertFormOwnership(req.params.id, req.user._id);
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
      status: nextStatus,
      publishedAt:
        nextStatus === "published" && !form.publishedAt
          ? new Date()
          : form.publishedAt,
      archivedAt: nextStatus === "archived" ? new Date() : form.archivedAt,
    });

    await form.save();

    return res.json({
      success: true,
      data: { ...form.toObject(), shareUrl: buildShareUrl(form) },
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
    const form = await assertFormOwnership(req.params.id, req.user._id);
    if (!form) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Form not found",
      });
    }

    await RsvpResponse.deleteMany({ formId: form._id });
    await form.deleteOne();

    return res.json({
      success: true,
      message: "Form deleted",
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
    const form = await assertFormOwnership(req.params.id, req.user._id);
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
    });

    return res.status(StatusCodes.CREATED).json({
      success: true,
      data: { ...copy.toObject(), shareUrl: buildShareUrl(copy) },
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
    const form = await assertFormOwnership(req.params.id, req.user._id);
    if (!form) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Form not found",
      });
    }

    form.status = req.body.status === "draft" ? "draft" : "published";
    form.publishedAt =
      form.status === "published" && !form.publishedAt
        ? new Date()
        : form.publishedAt;
    await form.save();

    return res.json({
      success: true,
      data: { ...form.toObject(), shareUrl: buildShareUrl(form) },
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
    
    // Only allow responses for published forms, unless it's for internal preview/testing
    // Allow draft forms to accept responses for preview/testing purposes
    if (form.status !== "published" && form.status !== "draft") {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Form is not available for responses",
      });
    }

    const { answers, tag, metadata = {} } = req.body || {};
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Answers are required",
      });
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
    const form = await assertFormOwnership(req.params.id, req.user._id);
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
    const form = await assertFormOwnership(req.params.id, req.user._id);
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

const getAnalytics = async (req, res) => {
  try {
    const form = await assertFormOwnership(req.params.id, req.user._id);
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

module.exports = {
  createForm,
  listForms,
  getForm,
  updateForm,
  deleteForm,
  duplicateForm,
  publishForm,
  getFormByPublicId,
  submitResponse,
  listResponses,
  updateResponseTag,
  getAnalytics,
};