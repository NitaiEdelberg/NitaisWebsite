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
  useToast,
} from "@chakra-ui/react";
import { FaMagic } from "react-icons/fa";
import { generatePoster } from "../utils/posterFallback";

const parseSuggestion = (text) => {
  const title = text.match(/Title:\s*(.*)/i)?.[1]?.trim() || "";
  const year = text.match(/Year:\s*(.*)/i)?.[1]?.trim() || "";
  const note =
    text.match(/Why you'?ll love it:\s*([\s\S]*)/i)?.[1]?.trim() || "";
  return { title, year, note };
};

const AiSuggestBox = () => {
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const getSuggestion = async () => {
    if (!input.trim()) {
      toast({ title: "Describe what you're in the mood for first.", status: "info", duration: 2500 });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input }),
      });
      const data = await res.json();
      const text = data.recommendation || data.suggestion || "";
      if (data.success && text) {
        setRaw(text);
        setResult(parseSuggestion(text));
      } else {
        toast({ title: "No suggestion available", description: "Try again in a moment.", status: "error", duration: 3000 });
      }
    } catch {
      toast({ title: "Could not reach the AI service", status: "error", duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  const handleAddClick = () => {
    const movie = {
      name: result?.title || "",
      year: result?.year || "",
      image: "",
      grade: "",
      note: result?.note || "",
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
              Describe a mood, genre or vibe — the AI will pick one film for you.
            </Text>
          </Box>
        </HStack>

        <InputGroup size="lg">
          <Input
            placeholder="e.g. a mind-bending sci-fi thriller for a rainy night"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && getSuggestion()}
            bg="bg.canvas"
            pr="9.5rem"
          />
          <InputRightElement width="9rem" pr={1}>
            <Button
              colorScheme="brand"
              onClick={getSuggestion}
              isLoading={loading}
              loadingText="Thinking"
              size="sm"
              w="full"
            >
              Recommend
            </Button>
          </InputRightElement>
        </InputGroup>

        {result && (
          <Box
            mt={2}
            p={4}
            borderRadius="xl"
            bg="bg.muted"
            border="1px solid"
            borderColor="border.subtle"
          >
            {result.title ? (
              <HStack spacing={4} align="start" flexDir={{ base: "column", sm: "row" }}>
                <Image
                  src={generatePoster(result.title, result.year)}
                  alt={result.title}
                  w={{ base: "full", sm: "140px" }}
                  h={{ base: "160px", sm: "90px" }}
                  objectFit="cover"
                  borderRadius="lg"
                />
                <Box flex={1}>
                  <Heading size="sm">
                    {result.title}{" "}
                    {result.year && (
                      <Text as="span" color="text.muted" fontWeight="500">
                        ({result.year})
                      </Text>
                    )}
                  </Heading>
                  <Text color="text.muted" fontSize="sm" mt={2}>
                    {result.note}
                  </Text>
                </Box>
              </HStack>
            ) : (
              <Text whiteSpace="pre-line">{raw}</Text>
            )}

            <HStack mt={4} spacing={2} flexWrap="wrap">
              <Button colorScheme="brand" size="sm" onClick={handleAddClick} isDisabled={!result.title}>
                Add to my library
              </Button>
              <Button variant="subtle" size="sm" onClick={getSuggestion} isLoading={loading}>
                Suggest another
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setResult(null)}>
                Dismiss
              </Button>
            </HStack>
          </Box>
        )}
      </VStack>
    </Box>
  );
};

export default AiSuggestBox;
