import {create} from "zustand";

//global state for movies
// Zustand is a small, fast and scalable bearbones state-management solution using simplified flux principles.
export const useMovieStore = create((set) => ({
    movies: [],
    setMovies: (movies) => set({ movies: movies }),
    createMovie: async(newMovie) => {
        if(!newMovie.name || !newMovie.year || !newMovie.image) {
            return {success: false, message: "Please fill all fields."}
        }
        const res = await fetch("/api/movies", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(newMovie),
        });
        const data = await res.json();
        set((state) => ({
            movies: [...state.movies, data.data],
        }));
        return {success: true, message: "movie created successfully"}
    },
    fetchMovies: async () => {
        const res = await fetch("/api/movies");
        const data = await res.json();
        set({ movies: data.data });
    },
    deleteMovie: async (id) => {
        const res = await fetch(`/api/movies/${id}`, {
            method: "DELETE",
        });
        const data = await res.json();
        if(!data.success) {
            return {success: false, message: data.message};
        }
        // update the ui immediately after deleting the movie without needing to refresh the page
        set((state) => ({
            movies: state.movies.filter((movie) => movie._id !== id)
        }));
        return {success: true, message: data.message};

    },
    updateMovie: async (pid, updatedMovie) => {
        const res = await fetch(`/api/movies/${pid}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(updatedMovie),
        });
        const data = await res.json();
        if(!data.success) {
            return {success: false, message: data.message};
        }
        // update the ui immediately after updating the movie without needing to refresh the page
        set((state) => ({
            movies: state.movies.map(movie => movie._id === pid ? data.data : movie)
        }));

        return {success: true, message: data.message};
    }
}));
