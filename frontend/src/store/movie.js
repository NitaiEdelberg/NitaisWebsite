import { create } from "zustand";
import { generatePoster, isBlank } from "../utils/posterFallback";

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : null;
};

export const useMovieStore = create((set) => ({
  movies: [],
  loading: false,
  hasFetched: false,
  setMovies: (movies) => set({ movies }),

  createMovie: async (newMovie) => {
    const headers = authHeaders();
    if (!headers) return { success: false, message: "Please log in first." };

    if (isBlank(newMovie.name) || isBlank(newMovie.year)) {
      return { success: false, message: "Title and release year are required." };
    }

    // Poster is optional in the UI — fall back to a generated one so the card
    // never renders broken and AI suggestions (no poster) can be saved.
    const payload = {
      ...newMovie,
      image: isBlank(newMovie.image)
        ? generatePoster(newMovie.name, newMovie.year)
        : newMovie.image.trim(),
      year: Number(newMovie.year),
      grade: isBlank(newMovie.grade) ? undefined : Number(newMovie.grade),
      note: newMovie.note?.trim() || undefined,
    };

    const res = await fetch("/api/movies", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!data.success) {
      return { success: false, message: data.message || "Could not add movie." };
    }

    set((state) => ({ movies: [data.data, ...state.movies] }));
    return { success: true, message: "Movie added to your library." };
  },

  fetchMovies: async () => {
    const headers = authHeaders();
    if (!headers) {
      set({ movies: [], loading: false, hasFetched: true });
      return;
    }

    set({ loading: true });
    try {
      const res = await fetch("/api/movies", { headers });
      const data = await res.json();
      if (data.success) set({ movies: data.data });
    } catch {
      // network error — keep whatever we had, surface via UI empty/error state
    } finally {
      set({ loading: false, hasFetched: true });
    }
  },

  deleteMovie: async (id) => {
    const headers = authHeaders();
    if (!headers) return { success: false, message: "Please log in first." };

    const res = await fetch(`/api/movies/${id}`, { method: "DELETE", headers });
    const data = await res.json();
    if (!data.success) {
      return { success: false, message: data.message || "Could not delete movie." };
    }

    set((state) => ({ movies: state.movies.filter((m) => m._id !== id) }));
    return { success: true, message: data.message || "Movie removed." };
  },

  updateMovie: async (pid, updatedMovie) => {
    const headers = authHeaders();
    if (!headers) return { success: false, message: "Please log in first." };

    if (isBlank(updatedMovie.name) || isBlank(updatedMovie.year)) {
      return { success: false, message: "Title and release year are required." };
    }

    const payload = {
      ...updatedMovie,
      image: isBlank(updatedMovie.image)
        ? generatePoster(updatedMovie.name, updatedMovie.year)
        : updatedMovie.image.trim(),
      year: Number(updatedMovie.year),
      grade: isBlank(updatedMovie.grade) ? undefined : Number(updatedMovie.grade),
      note: updatedMovie.note?.trim() || undefined,
    };

    const res = await fetch(`/api/movies/${pid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!data.success) {
      return { success: false, message: data.message || "Could not update movie." };
    }

    set((state) => ({
      movies: state.movies.map((m) => (m._id === pid ? data.data : m)),
    }));
    return { success: true, message: "Movie updated." };
  },

  logout: () => {
    localStorage.removeItem("token");
    set({ movies: [], hasFetched: false });
  },
}));
