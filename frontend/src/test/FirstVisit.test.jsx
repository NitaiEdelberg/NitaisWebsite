import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import FirstVisit from "../components/FirstVisit";
import { shouldShowTour } from "../utils/tourState";
import theme from "../theme";

const show = (props = {}) =>
  render(
    <ChakraProvider theme={theme}>
      <FirstVisit hasMovies={false} {...props} />
    </ChakraProvider>
  );

describe("the first-visit introduction", () => {
  beforeEach(() => localStorage.clear());

  it("greets someone with an empty library", () => {
    show();
    expect(screen.getByText(/Three things, then you are set/i)).toBeInTheDocument();
    expect(screen.getByText(/Add what you watch/i)).toBeInTheDocument();
  });

  it("stays out of the way of someone who already has films", () => {
    expect(shouldShowTour(true)).toBe(false);
    show({ hasMovies: true });
    expect(screen.queryByText(/Three things/i)).not.toBeInTheDocument();
  });

  it("does not come back once dismissed", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: /got it/i }));
    expect(screen.queryByText(/Three things/i)).not.toBeInTheDocument();
    expect(shouldShowTour(false)).toBe(false);
  });

  it("says that suggestions are checked against a real database", () => {
    show();
    expect(screen.getByText(/checked against a real film database/i)).toBeInTheDocument();
  });
});
