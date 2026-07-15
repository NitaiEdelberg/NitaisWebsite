import {
  Box,
  Button,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  SimpleGrid,
  Icon,
  Badge,
} from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { FaStar, FaRegStickyNote, FaMagic } from "react-icons/fa";

const features = [
  {
    icon: FaStar,
    title: "Rate every film",
    desc: "Score the movies you watch out of 10 and keep your taste in one place.",
  },
  {
    icon: FaRegStickyNote,
    title: "Personal notes",
    desc: "Jot down why a film stuck with you — a private journal for your watchlist.",
  },
  {
    icon: FaMagic,
    title: "AI recommendations",
    desc: "Describe a mood and get a fresh film suggestion you can save in one tap.",
  },
];

const Landing = () => {
  return (
    <Container maxW="1140px" px={4} py={{ base: 12, md: 20 }}>
      <VStack spacing={6} textAlign="center" maxW="720px" mx="auto">
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
        <Heading
          fontSize={{ base: "4xl", md: "6xl" }}
          lineHeight="1.05"
          letterSpacing="tight"
        >
          Every film you love,{" "}
          <Text
            as="span"
            bgGradient="linear(to-r, brand.300, brand.500)"
            bgClip="text"
          >
            in one place.
          </Text>
        </Heading>
        <Text fontSize={{ base: "md", md: "xl" }} color="text.muted">
          Save movies, rate them, keep private notes, and get AI-powered picks
          for whatever mood you&apos;re in. Free, fast, and yours.
        </Text>
        <HStack spacing={4} pt={2} flexDir={{ base: "column", sm: "row" }}>
          <Button as={Link} to="/register" colorScheme="brand" size="lg" px={8}>
            Get started — it&apos;s free
          </Button>
          <Button as={Link} to="/login" variant="subtle" size="lg" px={8}>
            Log in
          </Button>
        </HStack>
      </VStack>

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mt={{ base: 14, md: 20 }}>
        {features.map((f) => (
          <Box
            key={f.title}
            bg="bg.surface"
            border="1px solid"
            borderColor="border.subtle"
            borderRadius="xl"
            p={6}
            transition="all 0.2s"
            _hover={{ borderColor: "brand.500", transform: "translateY(-4px)" }}
          >
            <Box
              w={12}
              h={12}
              borderRadius="lg"
              bg="bg.muted"
              display="flex"
              alignItems="center"
              justifyContent="center"
              mb={4}
            >
              <Icon as={f.icon} boxSize={5} color="brand.400" />
            </Box>
            <Heading size="md" mb={2}>
              {f.title}
            </Heading>
            <Text color="text.muted">{f.desc}</Text>
          </Box>
        ))}
      </SimpleGrid>
    </Container>
  );
};

export default Landing;
