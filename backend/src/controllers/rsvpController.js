const { StatusCodes } = require("http-status-codes");
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");
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

const RSVP_SCANNER_TYPES = new Set(["rsvp_response", "rsvp"]);

const buildRsvpQrPayload = (_form, response) =>
  JSON.stringify({
    rid: response.responseId,
  });

const buildBrandedQrDataUrl = async (payload) => {
  let svg = await QRCode.toString(payload, {
    errorCorrectionLevel: "H",
    type: "svg",
    margin: 2,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });

  svg = svg.replace(
    /<rect([^>]*)width="1" height="1"/g,
    '<circle$1 r="0.5" cx="0.5" cy="0.5"',
  );

  let logoPath = path.join(__dirname, "../../uploads/logo/miniLogo.png");
  if (!fs.existsSync(logoPath)) {
    logoPath = path.join(__dirname, "../../../frontend/public/logo.png");
  }

  let logoSvg = "";
  if (fs.existsSync(logoPath)) {
    const logoBase64 = fs.readFileSync(logoPath, "base64");
    const viewBox = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
    const size = viewBox ? parseInt(viewBox[1], 10) : 41;
    const logoSize = size * 0.2;
    const center = size / 2;
    const x = center - logoSize / 2;
    const y = center - logoSize / 2;
    const padding = 1;
    const bgSize = logoSize + padding * 2;
    const bgX = x - padding;
    const bgY = y - padding;

    logoSvg = `
      <rect
        x="${bgX}"
        y="${bgY}"
        width="${bgSize}"
        height="${bgSize}"
        fill="white"
        rx="1" ry="1"
      />
      <image
        x="${x}"
        y="${y}"
        width="${logoSize}"
        height="${logoSize}"
        href="data:image/png;base64,${logoBase64}"
        preserveAspectRatio="xMidYMid meet"
      />
    `;
  }

  svg = svg.replace(
    /<rect x="0" y="0" width="7" height="7"[^>]*>/g,
    `<rect x="0" y="0" width="7" height="7" rx="2" ry="2" fill="#115db1"/>`,
  );

  svg = svg.replace(
    /<rect x="1" y="1" width="5" height="5"[^>]*>/g,
    `<rect x="1" y="1" width="5" height="5" rx="1.5" ry="1.5" fill="white"/>`,
  );

  svg = svg.replace(
    /<rect x="2" y="2" width="3" height="3"[^>]*>/g,
    `<rect x="2" y="2" width="3" height="3" rx="1" ry="1" fill="#115db1"/>`,
  );

  svg = svg.replace("</svg>", `${logoSvg}</svg>`);

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
};

const toResponseDto = (response) => {
  const responseObject =
    typeof response.toObject === "function" ? response.toObject() : response;

  return {
    ...responseObject,
    qrCodePayload: responseObject.qrCodePayload || "",
    qrCodeDataUrl: responseObject.qrCodeDataUrl || "",
  };
};

const normalizeFormVisibility = (form) => ({
  ...form,
  isPublic:
    form.type === "review"
      ? false
      : form.isPublic !== false,
  collectAttendeeInfo:
    form.type === "review"
      ? false
      : form.collectAttendeeInfo !== false,
  payment: form.payment
    ? {
        ...form.payment,
        enabled: false,
      }
    : form.payment,
});

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
  collectAttendeeInfo:
    body.type === "review"
      ? false
      : typeof body.collectAttendeeInfo === "boolean"
        ? body.collectAttendeeInfo
        : body.collectAttendeeInfo === "false"
          ? false
          : true,
  payment: body.payment
    ? {
        enabled: false,
        price: Number(body.payment.price || 0),
        currency: body.payment.currency || "USD",
        deadline: body.payment.deadline || undefined,
      }
    : undefined,
  anonymous: !!body.anonymous,
  isPublic:
    body.type === "review"
      ? false
      : typeof body.isPublic === "boolean"
        ? body.isPublic
        : body.isPublic === "false"
          ? false
          : true,
  sections: normalizeSections(Array.isArray(body.sections) ? body.sections : []),
  questions: normalizeQuestions(Array.isArray(body.questions) ? body.questions : []),
});

const toFormResponse = async (form) => {
  const formObject = normalizeFormVisibility(form.toObject());
  return {
    ...formObject,
    responseCount:
      form.responseCount ?? (await RsvpResponse.countDocuments({ formId: form._id })),
    shareUrl: buildShareUrl(form),
  };
};

const applyStatusLifecycle = (form, nextStatus) => {
  const status = nextStatus || form.status || "draft";
  form.status = status;
  form.isClosed = ["cancelled", "archived", "closed"].includes(status);

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
    form.isClosed = true;
  }

  return form;
};

const CONTACT_NAME_LABEL_PATTERN = /\b(full\s*name|name)\b/i;
const CONTACT_FIRST_NAME_LABEL_PATTERN = /\bfirst\s*name\b/i;
const CONTACT_LAST_NAME_LABEL_PATTERN = /\blast\s*name\b/i;
const CONTACT_PHONE_LABEL_PATTERN = /\b(phone|mobile|telephone|tel)\b/i;
const CONTACT_EMAIL_LABEL_PATTERN = /\bemail|e-mail\b/i;

const findAnswerValue = (form, answers, predicate) => {
  const question = (form.questions || []).find(predicate);
  if (!question) return "";

  const value = answers?.[question.id];
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

const buildSubmittedAttendee = (form, attendee = {}, answers = {}) => {
  if (form.type === "review") {
    return {
      fullName: "",
      email: "",
      phone: "",
    };
  }

  if (form.collectAttendeeInfo !== false) {
    return {
      fullName: String(attendee?.fullName || "").trim(),
      email: String(attendee?.email || "").trim().toLowerCase(),
      phone: String(attendee?.phone || "").trim(),
    };
  }

  const fullName = findAnswerValue(
    form,
    answers,
    (question) =>
      ["short_text", "long_text"].includes(question.type) &&
      CONTACT_NAME_LABEL_PATTERN.test(String(question.label || ""))
  );
  const firstName = findAnswerValue(
    form,
    answers,
    (question) =>
      ["short_text", "long_text"].includes(question.type) &&
      CONTACT_FIRST_NAME_LABEL_PATTERN.test(String(question.label || ""))
  );
  const lastName = findAnswerValue(
    form,
    answers,
    (question) =>
      ["short_text", "long_text"].includes(question.type) &&
      CONTACT_LAST_NAME_LABEL_PATTERN.test(String(question.label || ""))
  );

  return {
    fullName: fullName || [firstName, lastName].filter(Boolean).join(" ").trim(),
    email: findAnswerValue(
      form,
      answers,
      (question) =>
        question.type === "email" ||
        CONTACT_EMAIL_LABEL_PATTERN.test(String(question.label || ""))
    ).toLowerCase(),
    phone: findAnswerValue(
      form,
      answers,
      (question) =>
        question.type === "phone" ||
        CONTACT_PHONE_LABEL_PATTERN.test(String(question.label || ""))
    ),
  };
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
      isPublic: payload.isPublic,
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
        return { ...normalizeFormVisibility(form), shareUrl: buildShareUrl(form), responseCount };
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
    const requestedType = String(req.query.type || "").trim().toLowerCase();
    if (requestedType === "review") {
      return res.json({
        success: true,
        data: [],
      });
    }

    const query = {
      status: "published",
      isPublic: true,
      type: "rsvp",
      isDeleted: { $ne: true },
      deletedAt: null,
    };

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
        return {
          ...normalizeFormVisibility(sanitizePublicForm(form)),
          shareUrl: buildShareUrl(form),
          responseCount,
        };
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
      data: {
        ...normalizeFormVisibility(form.toObject()),
        shareUrl: buildShareUrl(form),
        responseCount,
      },
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
    form.isPublic = form.type === "review" ? false : payload.isPublic;

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

    const nextStatus =
      String(req.body?.status || "").toLowerCase() === "draft"
        ? "draft"
        : "published";

    applyStatusLifecycle(form, nextStatus);
    form.isPublic = form.type === "review" ? false : form.isPublic !== false;
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
      data: {
        ...normalizeFormVisibility(sanitizePublicForm(form)),
        shareUrl: buildShareUrl(form),
      },
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
    const form =
      req.rsvpForm ||
      (await RsvpForm.findOne({
        publicId: req.params.publicId,
      }));
    if (!form) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Form not found",
      });
    }

    const { answers, tag, metadata = {}, attendee = {} } = req.body || {};
    const normalizedStatus = String(form.status || "").toLowerCase();
    const previewBypass =
      req.allowPrivateRsvpSubmit === true && metadata?.preview === true;

    if (form.isDeleted || form.deletedAt) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Form is not available for responses",
      });
    }

    if (!previewBypass && normalizedStatus !== "published") {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Form is not available for responses",
      });
    }
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Answers are required",
      });
    }
    const submittedAttendee = buildSubmittedAttendee(form, attendee, answers);

    if (form.type === "rsvp" && !previewBypass) {
      const fullName = submittedAttendee.fullName;
      const email = submittedAttendee.email;
      const phone = submittedAttendee.phone;

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^\+?[0-9][0-9\s().-]{6,}$/;

      if (!fullName) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message:
            form.collectAttendeeInfo === false
              ? "Add a full name field to the form or enable attendee contact collection"
              : "Full name is required",
        });
      }
      if (!email || !emailRegex.test(email)) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message:
            form.collectAttendeeInfo === false
              ? "Add an email field to the form or enable attendee contact collection"
              : "A valid email address is required",
        });
      }
      if (!phone || !phoneRegex.test(phone)) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message:
            form.collectAttendeeInfo === false
              ? "Add a phone field to the form or enable attendee contact collection"
              : "A valid phone number is required",
        });
      }
    }

    const responseStatus =
      form.type === "review"
          ? "approved"
          : form.approvalMode === "manual"
            ? "pending"
            : "approved";

    const response = await RsvpResponse.create({
      formId: form._id,
      formPublicId: form.publicId,
      organizerId: form.organizerId,
      answers,
      attendee: submittedAttendee,
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

    if (form.type === "rsvp") {
      const qrCodePayload = buildRsvpQrPayload(form, response);
      const qrCodeDataUrl = await buildBrandedQrDataUrl(qrCodePayload);

      response.qrCodePayload = qrCodePayload;
      response.qrCodeDataUrl = qrCodeDataUrl;
      await response.save();
    }

    await RsvpForm.updateOne({ _id: form._id }, { $inc: { responseCount: 1 } });

    return res.status(StatusCodes.CREATED).json({
      success: true,
      data: toResponseDto(response),
    });
  } catch (error) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

const submitResponseByFormId = async (req, res) => {
  try {
    const form = await assertFormOwnership(req.params.id, req.user);
    if (!form) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Form not found",
      });
    }

    req.params.publicId = form.publicId;
    req.rsvpForm = form;
    req.allowPrivateRsvpSubmit = true;
    return submitResponse(req, res);
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Failed to submit response",
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
      data: responses.map(toResponseDto),
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
      data: toResponseDto(response),
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
      data: toResponseDto(response),
    });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const validateRsvpQr = async (req, res) => {
  try {
    const { qrData } = req.body || {};

    if (!qrData) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "QR code data is required",
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(qrData);
    } catch (error) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Invalid QR code format",
      });
    }

    const hasRsvpResponseId = Boolean(parsed.rid || parsed.responseId);
    const hasSupportedType = RSVP_SCANNER_TYPES.has(
      String(parsed.type || "").toLowerCase(),
    );

    if (!hasRsvpResponseId && !hasSupportedType) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Unsupported RSVP QR code",
      });
    }

    const responseId = parsed.rid || parsed.responseId;
    if (!responseId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Invalid QR code: missing response ID",
      });
    }

    const response = await RsvpResponse.findOne({ responseId })
      .populate("formId", "title date startTime endTime location organizerId approvalMode")
      .lean();

    if (!response || !response.formId) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "RSVP response not found",
      });
    }

    const form = response.formId;
    if (
      !hasAdminAccess(req.user) &&
      String(form.organizerId) !== String(req.user?._id)
    ) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: "You are not allowed to scan this RSVP response",
      });
    }

    const scopeFormId = String(req.body?.scopeFormId || "").trim();
    if (scopeFormId && String(form._id) !== scopeFormId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "This RSVP response does not belong to the selected RSVP form",
      });
    }

    const status = String(response.status || "").toLowerCase();
    const entryApproved = ["approved", "paid"].includes(status);

    if (response.checkedIn) {
      return res.status(StatusCodes.OK).json({
        success: true,
        alreadyCheckedIn: true,
        message: "RSVP already checked in",
        data: {
          responseId: response.responseId,
          entryType: "rsvp",
          eventTitle: form.title,
          eventDate: form.date,
          eventTime: [form.startTime, form.endTime].filter(Boolean).join(" - "),
          eventLocation: form.location,
          userName: response.attendee?.fullName || "Attendee",
          userEmail: response.attendee?.email || "",
          userPhone: response.attendee?.phone || "",
          checkedIn: true,
          checkedInAt: response.checkedInAt,
          status: response.status,
          approvalMode: form.approvalMode,
          requiresApproval: form.approvalMode === "manual",
          eligibleForEntry: entryApproved,
        },
      });
    }

    if (!entryApproved) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message:
          form.approvalMode === "manual"
            ? "RSVP is not approved yet"
            : "RSVP is not ready for entry",
      });
    }

    return res.status(StatusCodes.OK).json({
      success: true,
      data: {
        responseId: response.responseId,
        entryType: "rsvp",
        eventTitle: form.title,
        eventDate: form.date,
        eventTime: [form.startTime, form.endTime].filter(Boolean).join(" - "),
        eventLocation: form.location,
        userName: response.attendee?.fullName || "Attendee",
        userEmail: response.attendee?.email || "",
        userPhone: response.attendee?.phone || "",
        checkedIn: false,
        status: response.status,
        approvalMode: form.approvalMode,
        requiresApproval: form.approvalMode === "manual",
        eligibleForEntry: true,
      },
    });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Failed to validate RSVP QR",
    });
  }
};

const checkInRsvpResponse = async (req, res) => {
  try {
    const { responseId } = req.params;
    const scopeFormId = String(req.body?.scopeFormId || "").trim();

    const response = await RsvpResponse.findOne({ responseId }).populate(
      "formId",
      "title approvalMode organizerId",
    );

    if (!response || !response.formId) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "RSVP response not found",
      });
    }

    if (
      !hasAdminAccess(req.user) &&
      String(response.formId.organizerId) !== String(req.user?._id)
    ) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: "You are not allowed to check in this RSVP response",
      });
    }

    if (scopeFormId && String(response.formId._id) !== scopeFormId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "This RSVP response does not belong to the selected RSVP form",
      });
    }

    if (response.checkedIn) {
      return res.status(StatusCodes.OK).json({
        success: true,
        alreadyCheckedIn: true,
        message: "RSVP already checked in",
        data: {
          responseId: response.responseId,
          checkedIn: true,
          checkedInAt: response.checkedInAt,
        },
      });
    }

    if (!["approved", "paid"].includes(response.status)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message:
          response.formId.approvalMode === "manual"
            ? "RSVP is not approved yet"
            : "RSVP is not ready for entry",
      });
    }

    response.checkedIn = true;
    response.checkedInAt = new Date();
    await response.save();

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "RSVP attendee checked in",
      data: {
        responseId: response.responseId,
        checkedIn: true,
        checkedInAt: response.checkedInAt,
      },
    });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Failed to check in RSVP attendee",
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

    form.isPublic =
      form.type === "review"
        ? false
        : typeof req.body.isPublic === "boolean"
          ? req.body.isPublic
          : !form.isPublic;
    if (form.isPublic && form.status === "hidden") {
      form.status = "published";
      form.isClosed = false;
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
  submitResponseByFormId,
  listResponses,
  updateResponseTag,
  updateResponseStatus,
  getAnalytics,
  validateRsvpQr,
  checkInRsvpResponse,
};
