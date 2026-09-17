import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Input,
  Text,
  VStack,
  HStack,
  Heading,
  Image,
  InputGroup,
  InputRightElement,
  Badge,
  SimpleGrid,
  useToast,
} from "@chakra-ui/react";
import { FaMagic, FaStar } from "react-icons/fa";
import { generatePoster } from "../utils/posterFallback";
import { avoidList, rememberRejected, rememberShown } from "../utils/suggestionMemory";

const AiSuggestBox = () => {
  const [input, setInput] = useState("");
  const [movies, setMovies] = useState(null);
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [slow, setSlow] = useState(false);
  // What was shown, kept in localStorage rather than in state: this used to
  // reset on every reload, so the same prompt returned the same five films
  // tomorrow. The server also excludes everything already in your library.
  const navigate = useNavigate();
  const toast = useToast();

  const getSuggestions = async ({ more = false } = {}) => {
    if (!input.trim()) {
      toast({ title: "Describe what you're in the mood for first.", status: "info", duration: 2500 });
      return;
    }
    setLoading(true);
    setReport(null);
    // A free instance can take a while to wake, and an unexplained wait reads
    // as broken. Say so rather than spinning silently.
    const slowTimer = setTimeout(() => setSlow(true), 4000);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        // Always send the memory, not only when asking for more: a fresh
        // request for the same mood should not return yesterday's five films.
        body: JSON.stringify({ prompt: input, exclude: avoidList() }),
      });
      if (res.status === 401) {
        toast({ title: "Please log in again to use AI picks.", status: "warning", duration: 3000 });
        setMovies([]);
        return;
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.movies) && data.movies.length) {
        setMovies(data.movies);
        setSource(data.source || "");
        setReport(data.trace || null);
        rememberShown(data.movies.map((m) => m.title));
      } else {
        setMovies([]);
        toast({
          title: "No verified matches",
          description: data.message || "Try describing the vibe differently.",
          status: "info",
          duration: 3500,
        });
      }
    } catch {
      toast({ title: "Could not reach the AI service", status: "error", duration: 3000 });
    } finally {
      clearTimeout(slowTimer);
      setSlow(false);
      setLoading(false);
    }
  };

  const addToLibrary = (m) => {
    const movie = {
      name: m.title || "",
      year: m.year ? String(m.year) : "",
      image: m.poster || "",
      grade: "",
      note: m.overview ? m.overview.slice(0, 280) : "",
    };
    localStorage.setItem("aiSuggestedMovie", JSON.stringify(movie));
    navigate("/create");
  };

  return (
    <Box
      p={{ base: 5, md: 8 }}
      w="full"
      borderRadius="2xl"
      border="1px solid"
      borderColor="border.subtle"
      bg="bg.surface"
      backgroundImage="radial-gradient(600px 200px at 100% 0%, rgba(245,197,24,0.10), transparent 70%)"
    >
      <VStack spacing={4} align="stretch">
        <HStack spacing={3}>
          <Box color="brand.400"><FaMagic size={22} /></Box>
          <Box>
            <Heading size="md">Not sure what to watch?</Heading>
            <Text color="text.muted" fontSize="sm">
              Describe a mood, genre or vibe and you'll get real films (verified against a movie
              database, so nothing is made up).
            </Text>
          </Box>
        </HStack>

        <InputGroup size="lg">
          <Input
            placeholder="e.g. a mind-bending sci-fi thriller for a rainy night"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && getSuggestions()}
            bg="bg.canvas"
            pr="9.5rem"
          />
          <InputRightElement width="9rem" pr={1}>
            <Button
              colorScheme="brand"
              onClick={() => getSuggestions()}
              isLoading={loading}
              loadingText="Finding"
              size="sm"
              w="full"
            >
              Recommend
            </Button>
          </InputRightElement>
        </InputGroup>

        {loading && slow && (
          <Text fontSize="xs" color="text.muted">
            Still working. The first request after a quiet spell wakes the server,
            which takes a few seconds longer than the rest.
          </Text>
        )}

        {movies && movies.length > 0 && (
          <>
            <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3} mt={1}>
              {movies.map((m, i) => (
                <HStack
                  key={`${m.title}-${i}`}
                  spacing={3}
                  align="start"
                  p={3}
                  borderRadius="xl"
                  bg="bg.muted"
                  border="1px solid"
                  borderColor="border.subtle"
                >
                  <Image
                    src={m.poster || generatePoster(m.title, m.year)}
                    onError={(e) => { e.currentTarget.src = generatePoster(m.title, m.year); }}
                    alt={m.title}
                    w="70px"
                    minW="70px"
                    h="105px"
                    objectFit="cover"
                    borderRadius="md"
                  />
                  <Box flex={1} minW={0}>
                    <Heading size="sm" noOfLines={2}>
                      {m.title}{" "}
                      {m.year && (
                        <Text as="span" color="text.muted" fontWeight="500">
                          ({m.year})
                        </Text>
                      )}
                    </Heading>
                    {m.rating ? (
                      <HStack spacing={1} mt={1} color="brand.400">
                        <FaStar size={11} />
                        <Text fontSize="xs" color="text.muted">{m.rating.toFixed(1)}</Text>
                      </HStack>
                    ) : null}
                    <Text color="text.muted" fontSize="xs" mt={1} noOfLines={3}>
                      {m.overview || "No description available."}
                    </Text>
                    <HStack spacing={2} mt={2}>
                      <Button colorScheme="brand" size="xs" onClick={() => addToLibrary(m)}>
                        Add to library
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        color="text.muted"
                        onClick={() => {
                          rememberRejected(m.title);
                          setMovies((current) => (current || []).filter((x) => x.title !== m.title));
                        }}
                      >
                        Not for me
                      </Button>
                    </HStack>
                  </Box>
                </HStack>
              ))}
            </SimpleGrid>

            <HStack spacing={2} flexWrap="wrap">
              <Button variant="subtle" size="sm" onClick={() => getSuggestions({ more: true })} isLoading={loading}>
                Suggest more
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setMovies(null); setReport(null); }}>
                Clear
              </Button>
              {source && (
                <Badge ml="auto" colorScheme="gray" variant="subtle" alignSelf="center">
                  verified via {source === "tmdb" ? "TMDb" : "Wikipedia"}
                </Badge>
              )}
            </HStack>

            {report && (
              <Text fontSize="xs" color="text.muted">
                The model named {report.proposed}; {report.verified} matched a real film
                {report.unverifiable > 0 &&
                  `, ${report.unverifiable} could not be verified and ${report.unverifiable === 1 ? "was" : "were"} dropped`}
                {report.repeats_blocked > 0 && `, ${report.repeats_blocked} you already had`}
                {report.excluded > 0 && ` · avoiding ${report.excluded} you have seen or saved`}
                {report.taste_signals > 0 && ` · tuned to ${report.taste_signals} films you rated highly`}
                .
              </Text>
            )}
          </>
        )}
      </VStack>
    </Box>
  );
};

export default AiSuggestBox;
