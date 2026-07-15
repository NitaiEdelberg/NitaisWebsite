import { describe, it, expect, beforeEach, vi } from "vitest";
import { useMovieStore } from "../store/movie";

const reset = () =>
  useMovieStore.setState({ movies: [], loading: false, hasFetched: false });

describe("movie store", () => {
  beforeEach(() => {
    reset();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("requires auth to create", async () => {
    const res = await useMovieStore.getState().createMovie({ name: "X", year: 2000 });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/log in/i);
  });

  it("validates required title and year", async () => {
    localStorage.setItem("token", "t");
    const res = await useMovieStore.getState().createMovie({ name: "", year: "" });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/required/i);
  });

  it("falls back to a generated poster when image is blank and prepends the movie", async () => {
    localStorage.setItem("token", "t");
    const created = { _id: "1", name: "Heat", year: 1995, image: "data:..." };
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: created }),
    });
    global.fetch = spy;

    const res = await useMovieStore
      .getState()
      .createMovie({ name: "Heat", year: "1995", image: "", grade: "9", note: "great" });

    expect(res.success).toBe(true);
    // the request body should carry a generated poster + numeric year/grade
    const body = JSON.parse(spy.mock.calls[0][1].body);
    expect(body.image).toContain("data:image/svg+xml");
    expect(body.year).toBe(1995);
    expect(body.grade).toBe(9);
    // new movie is prepended to the list
    expect(useMovieStore.getState().movies[0]).toEqual(created);
  });

  it("keeps a provided image url", async () => {
    localStorage.setItem("token", "t");
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { _id: "2" } }),
    });
    global.fetch = spy;
    await useMovieStore
      .getState()
      .createMovie({ name: "Dune", year: "2021", image: "https://img/x.jpg" });
    const body = JSON.parse(spy.mock.calls[0][1].body);
    expect(body.image).toBe("https://img/x.jpg");
  });

  it("removes a movie on delete", async () => {
    localStorage.setItem("token", "t");
    useMovieStore.setState({ movies: [{ _id: "a" }, { _id: "b" }] });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: "deleted" }),
    });
    const res = await useMovieStore.getState().deleteMovie("a");
    expect(res.success).toBe(true);
    expect(useMovieStore.getState().movies).toEqual([{ _id: "b" }]);
  });

  it("logout clears movies and token", () => {
    localStorage.setItem("token", "t");
    useMovieStore.setState({ movies: [{ _id: "a" }] });
    useMovieStore.getState().logout();
    expect(localStorage.getItem("token")).toBe(null);
    expect(useMovieStore.getState().movies).toEqual([]);
  });
});
