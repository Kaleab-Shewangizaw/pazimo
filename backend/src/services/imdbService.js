const axios = require("axios");
const { BadRequestError } = require("../errors");

// Fetches a film's public details (plot, cast, genre, runtime, ...) from an
// IMDb id or link an organizer pastes in, so listing a film does not mean
// retyping its synopsis and cast by hand.
//
// IMDb itself has no public API for this. OMDb (omdbapi.com) is what people
// building on top of IMDb data actually use — it is keyed by the exact same
// "tt1234567" id every IMDb URL carries, and its fields (Plot, Actors, Genre,
// Rated, Runtime, Released, Poster) map directly onto CinemaMovie's own.
// Requires a free key from https://www.omdbapi.com/apikey.aspx in OMDB_API_KEY.

const OMDB_URL = "https://www.omdbapi.com/";

// Accepts a bare id ("tt1234567") or a full IMDb URL
// ("https://www.imdb.com/title/tt1234567/?ref_=...") — an organizer pasting
// straight from the address bar rarely trims it down to just the id.
const extractImdbId = (input) => {
  const match = String(input || "").match(/tt\d{7,9}/);
  if (!match) {
    throw new BadRequestError(
      "That doesn't look like an IMDb link or id — it should contain something like tt1234567."
    );
  }
  return match[0];
};

// OMDb writes the literal string "N/A" for a field it has nothing for,
// rather than omitting it, so every read has to filter that out by hand.
const clean = (value) => (value && value !== "N/A" ? value : undefined);

const splitList = (value) =>
  clean(value)
    ?.split(",")
    .map((v) => v.trim())
    .filter(Boolean) || [];

// "142 min" -> 142. A mini-series or short sometimes carries no runtime at all.
const parseRuntime = (value) => {
  const match = clean(value)?.match(/\d+/);
  return match ? Number(match[0]) : undefined;
};

// "14 Jul 2000" parses natively; anything OMDb sends that doesn't is dropped
// rather than guessed at, so the caller's own date validation is the one
// place a bad date gets rejected.
const parseReleaseDate = (value) => {
  const cleaned = clean(value);
  if (!cleaned) return undefined;
  const date = new Date(cleaned);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

/**
 * Look up a film on IMDb (via OMDb) by id or URL. Read-only — this never
 * touches the database; the caller decides what, if anything, to save.
 */
const fetchImdbMetadata = async (idOrUrl) => {
  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) {
    throw new BadRequestError(
      "IMDb lookup isn't configured yet — ask an admin to set OMDB_API_KEY."
    );
  }

  const imdbId = extractImdbId(idOrUrl);

  let response;
  try {
    response = await axios.get(OMDB_URL, {
      params: { i: imdbId, plot: "full", apikey: apiKey },
      timeout: 10000,
    });
  } catch (error) {
    // OMDb answers a bad or expired key with a non-2xx status (401), which
    // axios throws on — so the useful message ({Response:"False", Error:"Invalid
    // API key!"}) is on error.response.data, not on a successful response. A
    // network failure (DNS, timeout) never carries that body, hence the fallback.
    const omdbMessage = error.response?.data?.Error;
    console.error("[IMDB-SERVICE] OMDb request failed:", omdbMessage || error.message);
    throw new BadRequestError(
      omdbMessage || "Could not reach IMDb right now — try again in a moment."
    );
  }

  const data = response.data;
  if (!data || data.Response === "False") {
    throw new BadRequestError(data?.Error || "IMDb has nothing under that link.");
  }

  return {
    imdbId,
    title: clean(data.Title),
    description: clean(data.Plot),
    cast: splitList(data.Actors),
    genre: splitList(data.Genre),
    durationMinutes: parseRuntime(data.Runtime),
    ageRating: clean(data.Rated),
    // A single field, not a list — CinemaMovie.language is one string, so the
    // first credited language is what carries over; the rest is still on IMDb.
    language: splitList(data.Language)[0],
    releaseDate: parseReleaseDate(data.Released),
    poster: clean(data.Poster),
    imdbRating: clean(data.imdbRating),
  };
};

module.exports = { extractImdbId, fetchImdbMetadata };
