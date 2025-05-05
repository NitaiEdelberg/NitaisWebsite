import { create } from "zustand";

export const useMovieStore = create((set) => ({
  movies: [],
  setMovies: (movies) => set({ movies }),

  createMovie: async (newMovie) => {
    const token = localStorage.getItem("token");
    if (!token) return { success: false, message: "User not authenticated" };

    if (!newMovie.name || !newMovie.year || !newMovie.image) {
      return { success: false, message: "Please fill all fields." };
    }

    const res = await fetch("/api/movies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newMovie),
    });

    const data = await res.json();
    if (!data.success) {
      return { success: false, message: data.message };
    }

    set((state) => ({
      movies: [...state.movies, data.data],
    }));

    return { success: true, message: "Movie created successfully" };
  },

  fetchMovies: async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const res = await fetch("/api/movies", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    if (data.success) {
      set({ movies: data.data });
    }
  },

  deleteMovie: async (id) => {
    const token = localStorage.getItem("token");
    if (!token) return { success: false, message: "Not authenticated" };

    const res = await fetch(`/api/movies/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    if (!data.success) {
      return { success: false, message: data.message };
    }

    set((state) => ({
      movies: state.movies.filter((movie) => movie._id !== id),
    }));

    return { success: true, message: data.message };
  },

  updateMovie: async (pid, updatedMovie) => {
    const token = localStorage.getItem("token");
    if (!token) return { success: false, message: "Not authenticated" };

    const res = await fetch(`/api/movies/${pid}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updatedMovie),
    });

    const data = await res.json();
    if (!data.success) {
      return { success: false, message: data.message };
    }

    set((state) => ({
      movies: state.movies.map((movie) =>
        movie._id === pid ? data.data : movie
      ),
    }));

    return { success: true, message: data.message };
  },
  
  logout: () => {
    localStorage.removeItem('token');
    set({ movies: [] });
  }
}));
