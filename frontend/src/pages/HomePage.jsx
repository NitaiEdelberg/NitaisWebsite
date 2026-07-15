import {
  Container,
  VStack,
  HStack,
  Text,
  Heading,
  SimpleGrid,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Box,
  Skeleton,
  SkeletonText,
  Button,
  Icon,
  Divider,
} from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";
import { FaFilm } from "react-icons/fa";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMovieStore } from "../store/movie";
import MovieCard from "../components/MovieCard";
import AiSuggestBox from "../components/AiSuggestBox";
import Landing from "../components/Landing";

const StatPill = ({ label, value }) => (
  <Box
    bg="bg.surface"
    border="1px solid"
    borderColor="border.subtle"
    borderRadius="lg"
    px={4}
    py={2}
    minW="88px"
  >
    <Text fontSize="xl" fontWeight="800" color="brand.400" lineHeight={1}>
      {value}
    </Text>
    <Text fontSize="xs" color="text.muted" mt={1}>
      {label}
    </Text>
  </Box>
);

const CardSkeleton = () => (
  <Box bg="bg.surface" borderRadius="xl" overflow="hidden" border="1px solid" borderColor="border.subtle">
    <Skeleton height="180px" />
    <Box p={4}>
      <Skeleton height="18px" width="60%" mb={3} />
      <SkeletonText noOfLines={2} spacing={2} />
      <Skeleton height="32px" mt={4} borderRadius="md" />
    </Box>
  </Box>
);

const HomePage = () => {
  const token = localStorage.getItem("token");
  const { fetchMovies, movies, loading, hasFetched } = useMovieStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [sort, setSort] = useState("recent");

  useEffect(() => {
    fetchMovies();
  }, [fetchMovies]);

  const stats = useMemo(() => {
    const rated = movies.filter((m) => m.grade);
    const avg = rated.length
      ? (rated.reduce((s, m) => s + Number(m.grade), 0) / rated.length).toFixed(1)
      : "—";
    return { total: movies.length, rated: rated.length, avg };
  }, [movies]);

  const visibleMovies = useMemo(() => {
    const filtered = movies.filter((m) =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const sorters = {
      recent: (a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""),
      rating: (a, b) => (Number(b.grade) || 0) - (Number(a.grade) || 0),
      year: (a, b) => (Number(b.year) || 0) - (Number(a.year) || 0),
      title: (a, b) => a.name.localeCompare(b.name),
    };
    return [...filtered].sort(sorters[sort] || sorters.recent);
  }, [movies, searchTerm, sort]);

  // Logged-out visitors get a proper landing page instead of an empty grid.
  if (!token) return <Landing />;

  const isInitialLoading = loading && !hasFetched;
  const libraryEmpty = hasFetched && movies.length === 0;

  return (
    <Container maxW="1140px" px={4} py={{ base: 8, md: 12 }}>
      <VStack spacing={8} align="stretch">
        {/* Header + stats */}
        <Box>
          <Heading size="xl" letterSpacing="tight">
            Your Library
          </Heading>
          <Text color="text.muted" mt={1}>
            The films you&apos;ve saved, rated and noted.
          </Text>
          <HStack spacing={3} mt={5} flexWrap="wrap">
            <StatPill label="Movies" value={stats.total} />
            <StatPill label="Rated" value={stats.rated} />
            <StatPill label="Avg score" value={stats.avg} />
          </HStack>
        </Box>

        {!libraryEmpty && (
          <HStack spacing={3} flexDir={{ base: "column", sm: "row" }} align="stretch">
            <InputGroup maxW={{ base: "full", sm: "420px" }}>
              <InputLeftElement pointerEvents="none">
                <SearchIcon color="text.muted" />
              </InputLeftElement>
              <Input
                placeholder="Search your movies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                bg="bg.surface"
              />
            </InputGroup>
            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              maxW={{ base: "full", sm: "200px" }}
              bg="bg.surface"
            >
              <option value="recent">Recently added</option>
              <option value="rating">Highest rated</option>
              <option value="year">Newest release</option>
              <option value="title">Title (A–Z)</option>
            </Select>
          </HStack>
        )}

        {/* Grid states */}
        {isInitialLoading ? (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={8} w="full">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </SimpleGrid>
        ) : libraryEmpty ? (
          <Box
            textAlign="center"
            py={16}
            px={6}
            border="1px dashed"
            borderColor="border.subtle"
            borderRadius="2xl"
          >
            <Icon as={FaFilm} boxSize={10} color="brand.400" mb={4} />
            <Heading size="md" mb={2}>
              Your library is empty
            </Heading>
            <Text color="text.muted" maxW="420px" mx="auto" mb={6}>
              Add your first film — or describe a mood below and let the AI pick
              one for you.
            </Text>
            <Button as={Link} to="/create" colorScheme="brand" size="lg">
              Add your first movie
            </Button>
          </Box>
        ) : visibleMovies.length === 0 ? (
          <Box textAlign="center" py={12}>
            <Text fontSize="lg" fontWeight="600">
              No movies match &ldquo;{searchTerm}&rdquo;
            </Text>
            <Text color="text.muted" mt={1}>
              Try another title, or{" "}
              <Text as={Link} to="/create" color="brand.400" fontWeight="600">
                add it to your library
              </Text>
              .
            </Text>
          </Box>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={8} w="full">
            {visibleMovies.map((movie) => (
              <MovieCard key={movie._id} movie={movie} />
            ))}
          </SimpleGrid>
        )}

        <Divider borderColor="border.subtle" pt={4} />
        <AiSuggestBox />
      </VStack>
    </Container>
  );
};

export default HomePage;
