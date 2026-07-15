import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "./utils.jsx";
import MovieCard from "../components/MovieCard";

const movie = {
  _id: "1",
  name: "Heat",
  year: 1995,
  grade: 9,
  note: "A masterclass in tension.",
  image: "https://example.com/heat.jpg",
};

describe("MovieCard", () => {
  it("shows title, year, rating and note", () => {
    renderWithProviders(<MovieCard movie={movie} />);
    expect(screen.getByRole("heading", { name: /Heat/ })).toHaveTextContent("1995");
    expect(screen.getByText("9/10")).toBeInTheDocument();
    expect(screen.getByText(/masterclass in tension/i)).toBeInTheDocument();
  });

  it("uses a generated poster when no image is provided", () => {
    renderWithProviders(<MovieCard movie={{ ...movie, image: "" }} />);
    const img = screen.getByAltText(/Heat poster/i);
    expect(img.getAttribute("src")).toContain("data:image/svg+xml");
  });

  it('shows "Not rated" for movies without a grade', () => {
    renderWithProviders(<MovieCard movie={{ ...movie, grade: undefined }} />);
    expect(screen.getByText(/not rated/i)).toBeInTheDocument();
  });
});
