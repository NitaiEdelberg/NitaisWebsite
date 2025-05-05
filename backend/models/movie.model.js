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

const Movie = mongoose.model('Movie', movieSchema);

export default Movie;