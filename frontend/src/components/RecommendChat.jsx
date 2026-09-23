import { useEffect, useRef, useState } from "react";
import {
  Badge, Box, Button, HStack, Heading, IconButton, Image, Input, Spinner,
  Text, VStack, useToast, Wrap, WrapItem,
} from "@chakra-ui/react";
import { FaMagic, FaStar } from "react-icons/fa";

import { generatePoster } from "../utils/posterFallback";
import { useMovieStore } from "../store/movie";
import { askRecommender, rejectSuggestion } from "../api/recommend";

// The recommendation feature as a conversation.
//
// It used to be a text box and a button: one prompt in, five cards out, and
// every request started from nothing. That framing is why it felt like a
// search box with extra steps — you could not say "no, lighter than that",
// because there was no "that" to be lighter than.
//
// Two rules shape everything here. Refinement is the primary interaction, not
// an extra: the thread stays on screen and every reply is another turn. And the
// model's opinion is always visually separate from the verified facts — the
// one-line "why" is the model talking, the title, year and description come
// from a film database, and the footnote says how many suggestions were thrown
// away for not existing.

const OPENERS = [
  "Something slow and beautiful",
  "A heist with a twist",
  "Funny but not stupid",
  "Sad in a good way",
  "Like Interstellar, but lighter",
];

// What the assistant says while it works. Not decoration: the pipeline really
// does these things in this order, and a wait that names its stage reads as
// progress rather than as a hang.
const STAGES = [
  "Reading what you're after…",
  "Thinking of films…",
  "Checking each one is real…",
  "Dropping the ones you've seen…",
];

function StageIndicator() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => Math.min(i + 1, STAGES.length - 1)), 1800);
    return () => clearInterval(timer);
  }, []);
  return (
    <HStack spacing={3} color="text.muted" fontSize="sm" aria-live="polite">
      <Spinner size="sm" color="brand.400" />
      <Text>{STAGES[index]}</Text>
    </HStack>
  );
}

function SuggestionCard({ movie, onAdd, onReject, adding }) {
  return (
    <HStack
      align="start"
      spacing={3}
      p={3}
      bg="bg.canvas"
      borderRadius="lg"
      border="1px solid"
      borderColor="border.subtle"
    >
      <Image
        src={movie.poster || generatePoster(movie.title, movie.year)}
        onError={(e) => { e.currentTarget.src = generatePoster(movie.title, movie.year); }}
        alt=""
        w="64px"
        minW="64px"
        h="96px"
        objectFit="cover"
        borderRadius="md"
      />
      <Box flex="1" minW={0}>
        <HStack spacing={2} align="baseline" flexWrap="wrap">
          <Heading size="sm" noOfLines={1}>{movie.title}</Heading>
          {movie.year && <Text fontSize="xs" color="text.muted">{movie.year}</Text>}
          {typeof movie.rating === "number" && (
            <HStack spacing={1} color="brand.400">
              <FaStar size={10} />
              <Text fontSize="xs" color="text.muted">{movie.rating.toFixed(1)}</Text>
            </HStack>
          )}
        </HStack>

        {/* The model's opinion, marked as such. Everything below it is from a
            film database; this line is the only part the model wrote. */}
        {movie.why && (
          <HStack spacing={2} mt={1} align="start">
            <Badge colorScheme="purple" variant="subtle" fontSize="0.6rem" mt="2px">
              why this
            </Badge>
            <Text fontSize="sm" color="text.default">{movie.why}</Text>
          </HStack>
        )}

        {movie.overview && (
          <Text fontSize="xs" color="text.muted" mt={1} noOfLines={2}>
            {movie.overview}
          </Text>
        )}

        <HStack spacing={2} mt={2}>
          <Button size="xs" colorScheme="brand" onClick={() => onAdd(movie)} isLoading={adding}>
            Add to library
          </Button>
          <Button size="xs" variant="ghost" color="text.muted" onClick={() => onReject(movie)}>
            Not for me
          </Button>
        </HStack>
      </Box>
    </HStack>
  );
}

function Bubble({ from, children }) {
  const mine = from === "user";
  return (
    <Box
      alignSelf={mine ? "flex-end" : "flex-start"}
      bg={mine ? "brand.500" : "bg.muted"}
      color={mine ? "white" : "text.default"}
      px={4}
      py={2.5}
      borderRadius="xl"
      borderBottomRightRadius={mine ? "sm" : "xl"}
      borderBottomLeftRadius={mine ? "xl" : "sm"}
      maxW={{ base: "90%", md: "75%" }}
    >
      {children}
    </Box>
  );
}

export default function RecommendChat() {
  const [turns, setTurns] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(null);
  const endRef = useRef(null);
  const toast = useToast();
  const { createMovie } = useMovieStore();

  // Keep the newest turn in view, but never steal focus from the input.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns, busy]);

  async function send(text) {
    const message = (text ?? input).trim();
    if (!message || busy) return;

    setInput("");
    setError(null);
    setTurns((t) => [...t, { role: "user", text: message }]);
    setBusy(true);

    try {
      const data = await askRecommender(message);
      setTurns((t) => [
        ...t,
        { role: "assistant", text: data.reply, movies: data.movies || [], trace: data.trace },
      ]);
    } catch (err) {
      // The failed message stays on screen so the retry is one click, not a
      // retype.
      setError({ message: err.message || "Something went wrong.", retry: message });
    } finally {
      setBusy(false);
    }
  }

  async function add(movie) {
    setAdding(movie.title);
    const result = await createMovie({
      name: movie.title,
      year: movie.year,
      image: movie.poster || "",
    });
    setAdding(null);
    toast({
      title: result.success ? `${movie.title} added to your library` : result.message,
      status: result.success ? "success" : "error",
      duration: 2500,
      isClosable: true,
    });
  }

  async function reject(movie) {
    // Optimistic: the card goes immediately, because waiting for a round trip
    // to remove something you have dismissed feels broken.
    setTurns((t) =>
      t.map((turn) =>
        turn.movies
          ? { ...turn, movies: turn.movies.filter((m) => m.title !== movie.title) }
          : turn
      )
    );
    try {
      await rejectSuggestion(movie);
    } catch {
      // A lost rejection is not worth interrupting anybody over.
    }
  }

  const empty = turns.length === 0;

  return (
    <Box
      bg="bg.surface"
      border="1px solid"
      borderColor="border.subtle"
      borderRadius="2xl"
      overflow="hidden"
    >
      <HStack px={5} py={4} borderBottom="1px solid" borderColor="border.subtle" spacing={3}>
        <Box color="brand.400"><FaMagic /></Box>
        <Box flex="1">
          <Heading size="sm">Ask for something to watch</Heading>
          <Text fontSize="xs" color="text.muted">
            Every suggestion is checked against a real film database before you see it.
          </Text>
        </Box>
      </HStack>

      <VStack align="stretch" spacing={4} px={5} py={5} maxH="60vh" overflowY="auto">
        {empty && !busy && (
          <VStack align="stretch" spacing={3}>
            <Text color="text.muted" fontSize="sm">
              Describe a mood rather than a genre — it works better. Then keep talking:
              say &ldquo;lighter&rdquo;, &ldquo;seen it&rdquo;, or &ldquo;more like the second one&rdquo;.
            </Text>
            <Wrap>
              {OPENERS.map((opener) => (
                <WrapItem key={opener}>
                  <Button size="sm" variant="subtle" onClick={() => send(opener)}>
                    {opener}
                  </Button>
                </WrapItem>
              ))}
            </Wrap>
          </VStack>
        )}

        {turns.map((turn, i) => (
          <VStack key={i} align="stretch" spacing={3}>
            <Bubble from={turn.role}>
              <Text fontSize="sm">{turn.text}</Text>
            </Bubble>

            {turn.movies?.length > 0 && (
              <VStack align="stretch" spacing={2}>
                {turn.movies.map((movie) => (
                  <SuggestionCard
                    key={movie.title}
                    movie={movie}
                    onAdd={add}
                    onReject={reject}
                    adding={adding === movie.title}
                  />
                ))}
              </VStack>
            )}

            {/* The honest footnote. This is the product's central claim, and it
                used to be invisible. */}
            {turn.trace && (
              <Text fontSize="xs" color="text.muted" px={1}>
                {turn.trace.constraint && `${turn.trace.constraint} · `}
                {turn.trace.source === "catalogue" && "from the film catalogue · "}
                {turn.trace.proposed} suggested · {turn.trace.verified} verified as real
                {turn.trace.unverifiable > 0 && ` · ${turn.trace.unverifiable} dropped as unverifiable`}
                {/* Not "outside ${constraint}": the label already reads "from
                    2026", which rendered as "outside from 2026". */}
                {turn.trace.dropped_outside_constraint > 0 &&
                  ` · ${turn.trace.dropped_outside_constraint} dropped for the wrong year`}
                {turn.trace.blocked_as_seen > 0 && ` · ${turn.trace.blocked_as_seen} you'd already seen`}
                {turn.trace.preferences_used > 0 && ` · using ${turn.trace.preferences_used} things I know about your taste`}
              </Text>
            )}
          </VStack>
        ))}

        {busy && <StageIndicator />}

        {error && (
          <HStack
            spacing={3}
            p={3}
            borderRadius="lg"
            bg="bg.muted"
            border="1px solid"
            borderColor="red.400"
          >
            <Text fontSize="sm" flex="1">{error.message}</Text>
            <Button size="xs" onClick={() => send(error.retry)}>Try again</Button>
          </HStack>
        )}

        <div ref={endRef} />
      </VStack>

      <HStack px={5} py={4} borderTop="1px solid" borderColor="border.subtle" spacing={2}>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={empty ? "e.g. something quiet for a rainy night" : "Refine it — lighter, older, weirder…"}
          bg="bg.canvas"
          aria-label="Describe what you want to watch"
          isDisabled={busy}
        />
        <Button colorScheme="brand" onClick={() => send()} isLoading={busy} px={6}>
          Ask
        </Button>
      </HStack>
    </Box>
  );
}
