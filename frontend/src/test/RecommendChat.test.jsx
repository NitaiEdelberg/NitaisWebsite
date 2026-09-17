import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import RecommendChat from "../components/RecommendChat";
import theme from "../theme";

// The conversation, from the outside. What a person sees is what is asserted:
// their message on screen, the reply, the films, and — crucially — the line
// saying how many suggestions were thrown away for not being real.

const show = () =>
  render(
    <ChakraProvider theme={theme}>
      <RecommendChat />
    </ChakraProvider>
  );

const answer = (body, status = 200) =>
  Promise.resolve({
    ok: status < 400,
    status,
    headers: new Headers(),
    json: () => Promise.resolve(body),
  });

const goodReply = {
  success: true,
  reply: "Three quiet ones, then.",
  movies: [
    { title: "Paterson", year: 2016, why: "A week of small kindnesses.", overview: "A bus driver writes poems.", rating: 7.2, poster: "" },
    { title: "Columbus", year: 2017, why: "Architecture and grief, gently.", overview: "Two strangers in Indiana.", rating: 7.1, poster: "" },
  ],
  trace: { proposed: 8, verified: 2, unverifiable: 3, blocked_as_seen: 1, preferences_used: 2, shown: 2 },
};

beforeEach(() => {
  localStorage.setItem("token", "test-token");
  global.fetch = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

describe("the recommendation conversation", () => {
  it("offers openers before anything has been asked", () => {
    show();
    expect(screen.getByText(/Describe a mood rather than a genre/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /A heist with a twist/i })).toBeInTheDocument();
  });

  it("shows the question, the reply and the films", async () => {
    global.fetch.mockReturnValue(answer(goodReply));
    show();

    fireEvent.change(screen.getByLabelText(/Describe what you want to watch/i), {
      target: { value: "something quiet" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Ask$/i }));

    expect(await screen.findByText("something quiet")).toBeInTheDocument();
    expect(await screen.findByText("Three quiet ones, then.")).toBeInTheDocument();
    expect(screen.getByText("Paterson")).toBeInTheDocument();
    expect(screen.getByText("Columbus")).toBeInTheDocument();
  });

  it("says how many suggestions were dropped for not existing", async () => {
    global.fetch.mockReturnValue(answer(goodReply));
    show();
    fireEvent.click(screen.getByRole("button", { name: /Something slow and beautiful/i }));

    const note = await screen.findByText(/8 suggested/);
    expect(note).toHaveTextContent("2 verified as real");
    expect(note).toHaveTextContent("3 dropped as unverifiable");
    expect(note).toHaveTextContent("1 you'd already seen");
  });

  it("separates the model's opinion from the verified facts", async () => {
    global.fetch.mockReturnValue(answer(goodReply));
    show();
    fireEvent.click(screen.getByRole("button", { name: /Something slow and beautiful/i }));

    await screen.findByText("Paterson");
    // The model's sentence is labelled; the description beside it is not.
    expect(screen.getAllByText(/why this/i).length).toBe(2);
    expect(screen.getByText("A week of small kindnesses.")).toBeInTheDocument();
  });

  it("keeps the thread so a follow-up refines rather than restarts", async () => {
    global.fetch.mockReturnValue(answer(goodReply));
    show();

    fireEvent.click(screen.getByRole("button", { name: /Funny but not stupid/i }));
    await screen.findByText("Three quiet ones, then.");

    fireEvent.change(screen.getByLabelText(/Describe what you want to watch/i), {
      target: { value: "lighter than that" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Ask$/i }));

    expect(await screen.findByText("lighter than that")).toBeInTheDocument();
    // The first exchange is still on screen: that is what makes it a conversation.
    expect(screen.getByText("Funny but not stupid")).toBeInTheDocument();
  });

  it("offers a retry without making you retype", async () => {
    global.fetch.mockReturnValue(answer({ success: false, message: "The recommender is unavailable right now." }, 502));
    show();

    fireEvent.click(screen.getByRole("button", { name: /Sad in a good way/i }));
    expect(await screen.findByText(/unavailable right now/i)).toBeInTheDocument();

    global.fetch.mockReturnValue(answer(goodReply));
    fireEvent.click(screen.getByRole("button", { name: /Try again/i }));
    expect(await screen.findByText("Three quiet ones, then.")).toBeInTheDocument();
  });

  it("explains an expired session instead of failing silently", async () => {
    global.fetch.mockReturnValue(answer({}, 401));
    show();
    fireEvent.click(screen.getByRole("button", { name: /A heist with a twist/i }));
    expect(await screen.findByText(/session expired/i)).toBeInTheDocument();
  });

  it("removes a film you turn down straight away", async () => {
    global.fetch.mockReturnValue(answer(goodReply));
    show();
    fireEvent.click(screen.getByRole("button", { name: /Something slow and beautiful/i }));
    await screen.findByText("Paterson");

    fireEvent.click(screen.getAllByRole("button", { name: /Not for me/i })[0]);
    await waitFor(() => expect(screen.queryByText("Paterson")).not.toBeInTheDocument());
    expect(screen.getByText("Columbus")).toBeInTheDocument();
  });

  it("says what it is doing while it works", async () => {
    let settle;
    global.fetch.mockReturnValue(new Promise((resolve) => { settle = resolve; }));
    show();
    fireEvent.click(screen.getByRole("button", { name: /A heist with a twist/i }));

    expect(await screen.findByText(/Reading what you're after/i)).toBeInTheDocument();
    settle(await answer(goodReply));
  });
});
