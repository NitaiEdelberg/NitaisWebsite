import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "./utils.jsx";
import HomePage from "../pages/HomePage";
import { useMovieStore } from "../store/movie";

describe("HomePage", () => {
  beforeEach(() => {
    localStorage.clear();
    useMovieStore.setState({ movies: [], loading: false, hasFetched: false });
    vi.restoreAllMocks();
  });

  it("shows the marketing landing page when logged out", async () => {
    global.fetch = vi.fn();
    renderWithProviders(<HomePage />);
    expect(
      await screen.findByRole("link", { name: /get started/i })
    ).toBeInTheDocument();
    // logged-out visitors never trigger an authenticated movie fetch
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("renders the library with fetched movies when logged in", async () => {
    localStorage.setItem("token", "t");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          { _id: "1", name: "Heat", year: 1995, grade: 9, note: "n", image: "" },
        ],
      }),
    });

    renderWithProviders(<HomePage />);
    expect(await screen.findByText("Your Library")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /Heat/ })).toBeInTheDocument()
    );
  });

  it("shows an empty-state prompt when the library has no movies", async () => {
    localStorage.setItem("token", "t");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });

    renderWithProviders(<HomePage />);
    expect(
      await screen.findByText(/your library is empty/i)
    ).toBeInTheDocument();
  });
});
