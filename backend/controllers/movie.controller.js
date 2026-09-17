import Movie from "../models/movie.model.js";
import mongoose from 'mongoose';  

// A library is small today and unbounded in principle, so the listing is paged
// rather than "load everything and hope". The default page is larger than any
// library this app has seen, which keeps the existing client working unchanged
// while putting a ceiling on the worst case.
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

export const getMovies = async (req, res) => {
    const limit = Math.min(
        MAX_LIMIT,
        Math.max(1, Number.parseInt(req.query.limit, 10) || DEFAULT_LIMIT)
    );
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);

    try {
        // Always scoped to the authenticated user — never to an id from the
        // request — and sorted to match the {user, createdAt} index.
        const filter = { user: req.userId };
        const [movies, total] = await Promise.all([
            Movie.find(filter)
                // Projection: the grid needs these fields, and `user` is the
                // one field it must never receive.
                .select("name year image grade note createdAt")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Movie.countDocuments(filter),
        ]);

        res.status(200).json({
            success: true,
            data: movies,
            page,
            limit,
            total,
            has_more: page * limit < total,
        });
    } catch (error) {
        console.error("Error in get movies", error.message);
        res.status(500).json({success:false, message:"Server Error"});
    }
};

export const createMovie = async (req, res) => {
    const movie = req.body || {};

    if(!movie.name || !movie.year || !movie.image) {
        return res.status(400).json({ success:false, message: "Please fill all the fields" });
    }

    // Validated here rather than left to Mongoose, so the answer is a 400 with
    // a reason instead of a 500 with a cast error.
    const year = Number.parseInt(movie.year, 10);
    if (!Number.isInteger(year) || year < 1888 || year > new Date().getFullYear() + 5) {
        return res.status(400).json({ success:false, message: "That year doesn't look like a film release year." });
    }
    if (movie.grade !== undefined && movie.grade !== null && movie.grade !== "") {
        const grade = Number(movie.grade);
        if (Number.isNaN(grade) || grade < 0 || grade > 10) {
            return res.status(400).json({ success:false, message: "A score is between 0 and 10." });
        }
    }
    if (String(movie.name).length > 300 || String(movie.note || "").length > 2000) {
        return res.status(400).json({ success:false, message: "That title or note is too long." });
    }

    const newMovie = new Movie({
        // Field by field rather than spreading the body: a spread lets a
        // request set anything the schema happens to accept, including fields
        // added later by someone who did not know this line existed.
        name: String(movie.name).slice(0, 300),
        year,
        image: String(movie.image),
        grade: movie.grade === "" || movie.grade === undefined ? undefined : Number(movie.grade),
        note: movie.note ? String(movie.note).slice(0, 2000) : undefined,
        user: req.userId,  // the authenticated identity, never a body field
      });

    try {
        await newMovie.save();
        res.status(201).json({success: true, data: newMovie});
    } catch (error) {
        console.error("Error in create movie", error.message);
        res.status(500).json({success:false, message:"Server Error"});
    }
};

export const updateMovie = async (req, res) => {
    const { id } = req.params;

    const movie = req.body;
    // Never let the request body reassign ownership of the document.
    delete movie.user;

    if(!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({ success:false, message: "Movie does not exist: Invalid Movie Id" });
    }
    try {
        // Scope to the owner: a user can only update their own movies (prevents IDOR).
        const updatedMovie = await Movie.findOneAndUpdate({ _id: id, user: req.userId }, movie, {new: true});
        if(!updatedMovie) {
            return res.status(404).json({ success:false, message: "Movie not found" });
        }
        res.status(200).json({success: true, data: updatedMovie});
    } catch(error) {
        res.status(500).json({success:false, message:"Server Error"});
    }

};

export const deleteMovie = async (req, res) => {
    const { id } = req.params;
    
    if(!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({ success:false, message: "Movie does not exist: Invalid Movie Id" });
    }    

    try {
        // Scope to the owner: a user can only delete their own movies (prevents IDOR).
        const deleted = await Movie.findOneAndDelete({ _id: id, user: req.userId });
        if(!deleted) {
            return res.status(404).json({ success:false, message: "Movie not found" });
        }
        res.status(200).json({success: true, message: "Movie deleted successfully"});
    } catch(error) {
        console.log("Error in delete movie", error.message);
        res.status(500).json({success:false, message:"Server Error"});
    }
};