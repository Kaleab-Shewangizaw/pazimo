// Minimal, dependency-free defense against stored markup/script injection in
// free-text fields that are only ever meant to hold a plain name (firstName,
// lastName, fullName). Not a general HTML sanitizer — it just removes `<`
// and `>` so a value can never form a tag, which is enough to defeat the
// concrete payload seen in the field (`<script>alert(1)</script>`) without
// mangling legitimate international names, none of which legitimately
// contain angle brackets.
//
// Found 2026-09-03: raw `<script>` tags submitted in lastName during
// registration were stored unsanitized. No exploitable sink was found in the
// current frontend (React escapes text nodes by default; the one
// dangerouslySetInnerHTML use in the codebase is unrelated to name
// rendering), but persisting it unsanitized is one future raw-HTML view
// (an admin portal, an email template, a PDF export) away from being real.
const stripAngleBrackets = (value) =>
  typeof value === "string" ? value.replace(/[<>]/g, "") : value;

module.exports = { stripAngleBrackets };
