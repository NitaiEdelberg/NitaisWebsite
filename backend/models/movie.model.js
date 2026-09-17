import mongoose from "mongoose";

const movieSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    grade: {
        type: Number,
        required: false,
    },
    note: {
        type: String,
         required: false,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      }
}, {
    timestamps: true
});


// Every query this app makes starts with "this user's films", so that is the
// index. The compound index covers the default listing too — Mongo can serve
// {user} filtered and {createdAt} sorted from one index, which a single-field
// index on user cannot.
//
// Deliberately NOT indexed: name, year, grade. They are only ever filtered
// client-side within one person's library, which is tens of documents, and an
// index nobody queries is write cost with no read benefit.
movieSchema.index({ user: 1, createdAt: -1 });

const Movie = mongoose.model('Movie', movieSchema);

export default Movie;