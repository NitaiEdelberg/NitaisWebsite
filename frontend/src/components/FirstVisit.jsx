import { useState } from "react";
import {
  Box, Button, HStack, Heading, Text, VStack, CloseButton,
} from "@chakra-ui/react";
import { markTourSeen, shouldShowTour } from "../utils/tourState";

// What to do here, said once.
//
// A logged-in first-timer landed on an empty grid with an "Add movie" button
// and a search box, and nothing said that the search box writes to a real
// database or that the suggestions are checked against one. People do not read
// features; they read the first thing on the page, once.
//
// Three steps, because there are three things to do. Dismissed forever on this
// browser, and never shown to somebody who already has films saved — they have
// evidently worked it out.

const STEPS = [
  {
    title: "Add what you watch",
    body: "A title and a year is enough. Give it a score out of ten and a note about why it stuck with you — the note is the part you will be glad of in a year.",
  },
  {
    title: "Or describe a mood",
    body: "\"A mind-bending sci-fi thriller for a rainy night\" works better than a genre. You get five films back, and the ones you have already saved are never suggested.",
  },
  {
    title: "Nothing is invented",
    body: "Every suggestion is checked against a real film database before you see it. Anything the model names that turns out not to exist is dropped, and the count is shown underneath.",
  },
];

export default function FirstVisit({ hasMovies, onDismiss }) {
  const [open, setOpen] = useState(() => shouldShowTour(hasMovies));

  function dismiss() {
    setOpen(false);
    markTourSeen();
    if (onDismiss) onDismiss();
  }

  if (!open) return null;

  return (
    <Box
      bg="bg.muted"
      border="1px solid"
      borderColor="border.subtle"
      borderRadius="xl"
      p={{ base: 4, md: 5 }}
      mb={6}
      position="relative"
    >
      <CloseButton
        position="absolute"
        top={2}
        right={2}
        size="sm"
        onClick={dismiss}
        aria-label="Dismiss the introduction"
      />

      <VStack align="stretch" spacing={4}>
        <Box pr={8}>
          <Heading size="md">Three things, then you are set</Heading>
          <Text color="text.muted" fontSize="sm" mt={1}>
            This is a watchlist you keep, not a feed you scroll.
          </Text>
        </Box>

        <HStack
          align="stretch"
          spacing={4}
          flexDirection={{ base: "column", md: "row" }}
        >
          {STEPS.map((step, index) => (
            <Box
              key={step.title}
              flex="1"
              bg="bg.canvas"
              borderRadius="lg"
              p={4}
              border="1px solid"
              borderColor="border.subtle"
            >
              <Text fontSize="xs" color="brand.400" fontWeight="bold" mb={1}>
                {index + 1}
              </Text>
              <Heading size="sm" mb={1}>{step.title}</Heading>
              <Text color="text.muted" fontSize="sm">{step.body}</Text>
            </Box>
          ))}
        </HStack>

        <HStack>
          <Button colorScheme="brand" size="sm" onClick={dismiss}>
            Got it
          </Button>
          <Text fontSize="xs" color="text.muted">
            This only shows once.
          </Text>
        </HStack>
      </VStack>
    </Box>
  );
}
