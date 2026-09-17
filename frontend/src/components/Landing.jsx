import {
  Badge, Box, Button, Container, HStack, Heading, Icon, SimpleGrid, Text, VStack,
} from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { FaCheckCircle, FaMagic, FaRegStickyNote, FaStar } from "react-icons/fa";

// The first screen.
//
// It used to describe three features in three cards, which is what every
// product page does and what nobody reads. The thing worth saying about this
// one is specific: a language model will happily invent a film that does not
// exist, and this checks every suggestion against a film database before you
// see it. That is hard to believe from a sentence, so the page shows it — a
// real exchange, including the part where suggestions get thrown away.
//
// Marked as an example rather than dressed up as live data: a fake screenshot
// presented as real is the kind of thing that is embarrassing to explain.

const DEMO_MOVIES = [
  {
    title: "Paterson",
    year: 2016,
    why: "A week of small kindnesses, nothing louder.",
    overview: "A bus driver in New Jersey writes poems between shifts.",
  },
  {
    title: "The Straight Story",
    year: 1999,
    why: "Slow on purpose, and warm rather than sad.",
    overview: "An old man crosses Iowa on a lawnmower to see his brother.",
  },
];

const STEPS = [
  {
    icon: FaMagic,
    title: "Describe a mood",
    desc: "Not a genre. “Something quiet for a rainy night” works better than “drama”, and you can keep refining: lighter, older, seen it.",
  },
  {
    icon: FaCheckCircle,
    title: "Every title gets checked",
    desc: "Suggestions are verified against a real film database first. Anything that turns out not to exist is dropped before it reaches you, and the count is shown.",
  },
  {
    icon: FaRegStickyNote,
    title: "Keep what you watch",
    desc: "Save films, score them out of ten, and write down why one stuck with you. It learns what you like and stops suggesting what you have already seen.",
  },
];

function DemoCard({ movie }) {
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
      <Box
        w="44px"
        minW="44px"
        h="66px"
        borderRadius="md"
        bgGradient="linear(to-br, brand.600, bg.muted)"
        aria-hidden="true"
      />
      <Box minW={0}>
        <HStack spacing={2} align="baseline">
          <Heading size="xs">{movie.title}</Heading>
          <Text fontSize="xs" color="text.muted">{movie.year}</Text>
        </HStack>
        <HStack spacing={2} mt={1} align="start">
          <Badge colorScheme="purple" variant="subtle" fontSize="0.55rem" mt="2px">
            why this
          </Badge>
          <Text fontSize="xs">{movie.why}</Text>
        </HStack>
        <Text fontSize="xs" color="text.muted" mt={1} noOfLines={1}>
          {movie.overview}
        </Text>
      </Box>
    </HStack>
  );
}

const Landing = () => (
  <Container maxW="1140px" px={4} py={{ base: 10, md: 16 }}>
    <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={{ base: 10, lg: 14 }} alignItems="center">
      {/* ---- the claim ---- */}
      <VStack align={{ base: "center", lg: "start" }} spacing={5} textAlign={{ base: "center", lg: "left" }}>
        <Badge
          colorScheme="yellow"
          bg="bg.muted"
          color="brand.400"
          borderRadius="full"
          px={3}
          py={1}
          fontWeight="600"
        >
          🎬 Your personal movie library
        </Badge>

        <Heading as="h1" fontSize={{ base: "3xl", md: "5xl" }} lineHeight="1.08" letterSpacing="tight">
          A film recommender that{" "}
          <Text as="span" bgGradient="linear(to-r, brand.300, brand.500)" bgClip="text">
            can&apos;t make things up
          </Text>
        </Heading>

        <Text fontSize={{ base: "md", md: "lg" }} color="text.muted" maxW="34rem">
          Describe what you feel like watching and keep talking until it gets there.
          Every suggestion is checked against a real film database before it reaches
          you — so nothing it recommends is invented, and it never offers a film
          you have already saved.
        </Text>

        <HStack spacing={3} pt={1} flexDir={{ base: "column", sm: "row" }} w={{ base: "full", sm: "auto" }}>
          <Button as={Link} to="/register" colorScheme="brand" size="lg" px={8} w={{ base: "full", sm: "auto" }}>
            Start your library
          </Button>
          <Button as={Link} to="/login" variant="subtle" size="lg" px={8} w={{ base: "full", sm: "auto" }}>
            Log in
          </Button>
        </HStack>

        <Text fontSize="xs" color="text.muted">
          Free, and your notes stay private to your account.
        </Text>
      </VStack>

      {/* ---- the same claim, demonstrated ---- */}
      <Box
        bg="bg.surface"
        border="1px solid"
        borderColor="border.subtle"
        borderRadius="2xl"
        p={{ base: 4, md: 5 }}
        aria-label="Example of a recommendation conversation"
      >
        <HStack justify="space-between" mb={4}>
          <HStack spacing={2} color="text.muted" fontSize="xs">
            <Icon as={FaMagic} color="brand.400" />
            <Text>A real exchange</Text>
          </HStack>
          <Badge variant="subtle" fontSize="0.55rem">example</Badge>
        </HStack>

        <VStack align="stretch" spacing={3}>
          <Box alignSelf="flex-end" bg="brand.500" color="white" px={4} py={2} borderRadius="xl" borderBottomRightRadius="sm" maxW="85%">
            <Text fontSize="sm">Something gentle, nothing with a body count</Text>
          </Box>

          <Box alignSelf="flex-start" bg="bg.muted" px={4} py={2} borderRadius="xl" borderBottomLeftRadius="sm" maxW="85%">
            <Text fontSize="sm">Two quiet ones, both about small lives rather than big events.</Text>
          </Box>

          {DEMO_MOVIES.map((movie) => (
            <DemoCard key={movie.title} movie={movie} />
          ))}

          {/* The honest footnote is the point of the whole demonstration. */}
          <Text fontSize="xs" color="text.muted" px={1}>
            8 suggested · 5 verified as real · 3 dropped as unverifiable · 1 you&apos;d already seen
          </Text>
        </VStack>
      </Box>
    </SimpleGrid>

    {/* ---- how it works ---- */}
    <Box mt={{ base: 14, md: 20 }}>
      <Heading as="h2" size="md" mb={6} textAlign={{ base: "center", md: "left" }}>
        How it works
      </Heading>
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
        {STEPS.map((step) => (
          <Box
            key={step.title}
            bg="bg.surface"
            border="1px solid"
            borderColor="border.subtle"
            borderRadius="xl"
            p={6}
            transition="border-color 0.15s"
            _hover={{ borderColor: "brand.500" }}
          >
            <Box
              w={11}
              h={11}
              borderRadius="lg"
              bg="bg.muted"
              display="flex"
              alignItems="center"
              justifyContent="center"
              mb={4}
            >
              <Icon as={step.icon} boxSize={5} color="brand.400" aria-hidden="true" />
            </Box>
            <Heading as="h3" size="sm" mb={2}>{step.title}</Heading>
            <Text color="text.muted" fontSize="sm">{step.desc}</Text>
          </Box>
        ))}
      </SimpleGrid>
    </Box>

    {/* ---- the one number worth putting on a landing page ---- */}
    <HStack
      mt={{ base: 10, md: 14 }}
      p={5}
      bg="bg.surface"
      border="1px solid"
      borderColor="border.subtle"
      borderRadius="xl"
      spacing={4}
      align="start"
    >
      <Icon as={FaStar} color="brand.400" boxSize={5} mt={1} aria-hidden="true" />
      <Box>
        <Heading as="h3" size="sm" mb={1}>Why the checking matters</Heading>
        <Text color="text.muted" fontSize="sm" maxW="60rem">
          Ask any chatbot for film recommendations and some of what comes back will not
          exist — a plausible title, a plausible year, a plausible director, and no such
          film. Here the model only proposes; a film database decides what is real, and
          whatever fails is dropped before you see it. The count of what was dropped is
          shown with every answer, because a claim you cannot check is just a claim.
        </Text>
      </Box>
    </HStack>
  </Container>
);

export default Landing;
