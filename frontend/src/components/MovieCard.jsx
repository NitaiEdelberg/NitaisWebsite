import {
  Box,
  Button,
  Heading,
  HStack,
  IconButton,
  Image,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  Textarea,
  FormControl,
  FormLabel,
  Badge,
  useDisclosure,
  useToast,
  VStack,
  AspectRatio,
} from "@chakra-ui/react";
import { DeleteIcon, EditIcon } from "@chakra-ui/icons";
import { FaStar } from "react-icons/fa";
import { useState } from "react";
import { useMovieStore } from "../store/movie";
import { RatingInput, StarRating } from "./StarRating";
import { generatePoster } from "../utils/posterFallback";

const MovieCard = ({ movie }) => {
  const [updatedMovie, setUpdatedMovie] = useState(movie);
  const [imgError, setImgError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { deleteMovie, updateMovie } = useMovieStore();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const openEditor = () => {
    setUpdatedMovie(movie);
    onOpen();
  };

  const handleDeleteMovie = async () => {
    setDeleting(true);
    const { success, message } = await deleteMovie(movie._id);
    setDeleting(false);
    toast({
      title: success ? "Removed" : "Error",
      description: message,
      status: success ? "success" : "error",
      duration: 3000,
      isClosable: true,
    });
  };

  const handleUpdateMovie = async () => {
    setSaving(true);
    const { success, message } = await updateMovie(movie._id, updatedMovie);
    setSaving(false);
    if (success) onClose();
    toast({
      title: success ? "Saved" : "Error",
      description: message,
      status: success ? "success" : "error",
      duration: 3000,
      isClosable: true,
    });
  };

  const posterSrc = imgError || !movie.image
    ? generatePoster(movie.name, movie.year)
    : movie.image;

  return (
    <Box
      bg="bg.surface"
      borderRadius="xl"
      overflow="hidden"
      border="1px solid"
      borderColor="border.subtle"
      shadow="md"
      transition="all 0.25s ease"
      _hover={{ transform: "translateY(-6px)", shadow: "2xl", borderColor: "brand.500" }}
      role="group"
    >
      <Box position="relative">
        <AspectRatio ratio={16 / 10}>
          <Image
            src={posterSrc}
            alt={`${movie.name} poster`}
            objectFit="cover"
            onError={() => setImgError(true)}
          />
        </AspectRatio>
        {/* bottom scrim for legibility */}
        <Box
          position="absolute"
          inset={0}
          bgGradient="linear(to-t, blackAlpha.700, transparent 45%)"
          pointerEvents="none"
        />
        {movie.grade ? (
          <Badge
            position="absolute"
            top={2}
            right={2}
            display="flex"
            alignItems="center"
            gap={1}
            bg="blackAlpha.700"
            color="brand.400"
            borderRadius="full"
            px={2.5}
            py={1}
            fontSize="sm"
            backdropFilter="blur(4px)"
          >
            <FaStar /> {movie.grade}
          </Badge>
        ) : null}
        <Heading
          as="h3"
          size="md"
          position="absolute"
          bottom={3}
          left={4}
          right={4}
          color="white"
          textShadow="0 2px 8px rgba(0,0,0,0.6)"
          noOfLines={2}
        >
          {movie.name}
          <Text as="span" fontWeight="500" opacity={0.85}>
            {" "}({movie.year})
          </Text>
        </Heading>
      </Box>

      <Box p={4}>
        <StarRating grade={movie.grade} />
        <Text color="text.muted" mt={3} noOfLines={3} minH="1.5rem" fontStyle={movie.note ? "normal" : "italic"}>
          {movie.note || "No note yet."}
        </Text>

        <HStack spacing={2} mt={4}>
          <Button
            leftIcon={<EditIcon />}
            onClick={openEditor}
            variant="subtle"
            size="sm"
            flex={1}
          >
            Edit
          </Button>
          <IconButton
            icon={<DeleteIcon />}
            onClick={handleDeleteMovie}
            isLoading={deleting}
            aria-label={`Delete ${movie.name}`}
            variant="ghost"
            colorScheme="red"
            size="sm"
          />
        </HStack>
      </Box>

      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent mx={4}>
          <ModalHeader>Edit movie</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel fontSize="sm">Title</FormLabel>
                <Input
                  value={updatedMovie.name}
                  onChange={(e) => setUpdatedMovie({ ...updatedMovie, name: e.target.value })}
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontSize="sm">Release year</FormLabel>
                <Input
                  type="number"
                  value={updatedMovie.year}
                  onChange={(e) => setUpdatedMovie({ ...updatedMovie, year: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Poster image URL</FormLabel>
                <Input
                  placeholder="Leave blank for an auto-generated poster"
                  value={updatedMovie.image}
                  onChange={(e) => setUpdatedMovie({ ...updatedMovie, image: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Your rating</FormLabel>
                <RatingInput
                  value={updatedMovie.grade}
                  onChange={(grade) => setUpdatedMovie({ ...updatedMovie, grade })}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Personal note</FormLabel>
                <Textarea
                  rows={3}
                  value={updatedMovie.note || ""}
                  onChange={(e) => setUpdatedMovie({ ...updatedMovie, note: e.target.value })}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="brand" onClick={handleUpdateMovie} isLoading={saving}>
              Save changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default MovieCard;
