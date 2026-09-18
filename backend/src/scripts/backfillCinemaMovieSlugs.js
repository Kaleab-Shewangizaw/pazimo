const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const CinemaMovie = require("../models/CinemaMovie");

// One-off backfill for films created before slug/shortId existed.
//
// Without these two fields a film's public URL falls back to /cinema/{objectId},
// so every card on the home page and the cinema page links to an unreadable id.
//
// Safe to re-run: the pre-validate hook on CinemaMovie only fills a field that
// is missing, and this query only selects rows that are missing one — so films
// that already have a URL keep the exact slug and shortId they were published
// with. That matters: the shortId is what old links resolve through, and
// regenerating it would break every link already shared.
const backfillCinemaMovieSlugs = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.warn(
        "MONGODB_URI is not defined in .env, please pass it as an env var"
      );
    }
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`Connected to MongoDB (${mongoose.connection.name})`);

    const movies = await CinemaMovie.find({
      $or: [
        { slug: { $exists: false } },
        { slug: null },
        { slug: "" },
        { shortId: { $exists: false } },
        { shortId: null },
        { shortId: "" },
      ],
    }).sort("createdAt");

    console.log(`Found ${movies.length} film(s) without a public URL`);

    let done = 0;
    for (const movie of movies) {
      // save() runs ensureMovieUrlFields, which slugifies the title and claims
      // a unique shortId. Nothing else on the document is touched.
      await movie.save();
      console.log(`  ${movie.title} -> /cinema/${movie.slug}-${movie.shortId}`);
      done += 1;
    }

    console.log(`Backfill complete — ${done} film(s) updated`);
    process.exit(0);
  } catch (error) {
    console.error("Backfill failed:", error.message);
    process.exit(1);
  }
};

backfillCinemaMovieSlugs();
