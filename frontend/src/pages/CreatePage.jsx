import {
  Box,
  Button,
  Container,
  Heading,
  Input,
  Textarea,
  Image,
  Text,
  VStack,
  HStack,
  FormControl,
  FormLabel,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMovieStore } from "../store/movie";
import { RatingInput } from "../components/StarRating";
import { generatePoster, isBlank } from "../utils/posterFallback";

const EMPTY = { name: "", year: "", image: "", grade: "", note: "" };

const CreatePage = () => {
  const [newMovie, setNewMovie] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const { createMovie } = useMovieStore();

  useEffect(() => {
    const saved = localStorage.getItem("aiSuggestedMovie");
    if (saved) {
      setNewMovie({ ...EMPTY, ...JSON.parse(saved) });
      localStorage.removeItem("aiSuggestedMovie");
      toast({ title: "AI pick loaded — review and save it.", status: "info", duration: 3000 });
    }
  }, [toast]);

  const set = (field) => (e) =>
    setNewMovie((m) => ({ ...m, [field]: e.target.value }));

  const previewSrc = isBlank(newMovie.image)
    ? generatePoster(newMovie.name || "Untitled", newMovie.year)
    : newMovie.image;

  const handleAddMovie = async () => {
    setSaving(true);
    const { success, message } = await createMovie(newMovie);
    setSaving(false);
    toast({
      title: success ? "Added" : "Error",
      description: message,
      status: success ? "success" : "error",
      isClosable: true,
      duration: 3000,
    });
    if (success) {
      setNewMovie(EMPTY);
      navigate("/");
    }
  };

  return (
    <Container maxW="container.sm" py={{ base: 8, md: 12 }}>
      <Heading size="xl" textAlign="center" mb={8}>
        Add a movie
      </Heading>

      <Box
        w="full"
        bg="bg.surface"
        p={{ base: 5, md: 8 }}
        borderRadius="2xl"
        border="1px solid"
        borderColor="border.subtle"
        shadow="lg"
      >
        <VStack spacing={5} align="stretch">
          <HStack spacing={4} align="start">
            <Image
              src={previewSrc}
              alt="Poster preview"
              w="96px"
              h="120px"
              objectFit="cover"
              borderRadius="lg"
              border="1px solid"
              borderColor="border.subtle"
              onError={(e) => {
                e.currentTarget.src = generatePoster(newMovie.name || "Untitled", newMovie.year);
              }}
            />
            <VStack flex={1} spacing={4} align="stretch">
              <FormControl isRequired>
                <FormLabel fontSize="sm">Title</FormLabel>
                <Input placeholder="e.g. Inception" value={newMovie.name} onChange={set("name")} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontSize="sm">Release year</FormLabel>
                <Input
                  placeholder="2010"
                  type="number"
                  min={1888}
                  max={2100}
                  value={newMovie.year}
                  onChange={set("year")}
                />
              </FormControl>
            </VStack>
          </HStack>

          <FormControl>
            <FormLabel fontSize="sm">Poster image URL</FormLabel>
            <Input
              placeholder="Leave blank for an auto-generated poster"
              value={newMovie.image}
              onChange={set("image")}
            />
          </FormControl>

          <FormControl>
            <FormLabel fontSize="sm">Your rating</FormLabel>
            <RatingInput
              value={newMovie.grade}
              onChange={(grade) => setNewMovie((m) => ({ ...m, grade }))}
            />
          </FormControl>

          <FormControl>
            <FormLabel fontSize="sm">Personal note</FormLabel>
            <Textarea
              placeholder="What did you think? (optional)"
              rows={3}
              value={newMovie.note}
              onChange={set("note")}
            />
          </FormControl>

          <HStack spacing={3} pt={1}>
            <Button variant="ghost" onClick={() => navigate("/")} flex={{ base: 1, sm: "none" }}>
              Cancel
            </Button>
            <Button colorScheme="brand" onClick={handleAddMovie} isLoading={saving} flex={1}>
              Add to my library
            </Button>
          </HStack>
        </VStack>
      </Box>
    </Container>
  );
};

export default CreatePage;
