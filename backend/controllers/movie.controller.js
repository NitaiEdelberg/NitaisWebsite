import Movie from "../models/movie.model.js";
import mongoose from 'mongoose';  

export const getMovies = async (req, res) => {
    try {
        const movies = await Movie.find({});
        res.status(200).json({success: true, data: movies});
    } catch (error) {
        console.log("Error in get movies", error.message);
        res.status(500).json({success:false, message:"Server Error"});
    }
};

export const creatMovie = async (req, res) => {
    const movie = req.body; // data that the user will send

    if(!movie.name || !movie.year || !movie.image) {
        return res.status(400).json({ success:false, message: "Please fill all the fields" });
    }

    const newMovie = new Movie(movie);

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

    if(!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({ success:false, message: "Movie does not exist: Invalid Movie Id" });
    }    
    try { 
        const updatedMovie = await Movie.findByIdAndUpdate(id, movie, {new: true});
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
        await movie.findByIdAndDelete(id);
        res.status(200).json({success: true, message: "Movie deleted successfully"});
    } catch(error) {
        console.log("Error in delete movie", error.message);
        res.status(500).json({success:false, message:"Server Error"});
    }
};