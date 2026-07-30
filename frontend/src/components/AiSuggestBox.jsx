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

const AiSuggestBox = () => {
  const [input, setInput] = useState("");
  const [movies, setMovies] = useState(null);
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  // Titles already shown, so "Suggest more" doesn't repeat them.
  const [seen, setSeen] = useState([]);
  const navigate = useNavigate();
  const toast = useToast();

  const getSuggestions = async ({ more = false } = {}) => {
    if (!input.trim()) {
      toast({ title: "Describe what you're in the mood for first.", status: "info", duration: 2500 });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input, exclude: more ? seen : [] }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.movies) && data.movies.length) {
        setMovies(data.movies);
        setSource(data.source || "");
        setSeen((prev) => [...new Set([...prev, ...data.movies.map((m) => m.title)])]);
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
              Describe a mood, genre or vibe — you'll get real films (verified against a movie
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
                    <Button colorScheme="brand" size="xs" mt={2} onClick={() => addToLibrary(m)}>
                      Add to library
                    </Button>
                  </Box>
                </HStack>
              ))}
            </SimpleGrid>

            <HStack spacing={2} flexWrap="wrap">
              <Button variant="subtle" size="sm" onClick={() => getSuggestions({ more: true })} isLoading={loading}>
                Suggest more
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setMovies(null); setSeen([]); }}>
                Clear
              </Button>
              {source && (
                <Badge ml="auto" colorScheme="gray" variant="subtle" alignSelf="center">
                  verified via {source === "tmdb" ? "TMDb" : "Wikipedia"}
                </Badge>
              )}
            </HStack>
          </>
        )}
      </VStack>
    </Box>
  );
};

export default AiSuggestBox;
