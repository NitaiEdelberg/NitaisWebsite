import { HStack, Icon, Box, Text } from "@chakra-ui/react";
import { FaStar, FaStarHalfAlt, FaRegStar } from "react-icons/fa";
import { useState } from "react";

// Read-only display: grade is 1-10, shown as 5 proportional stars + number.
export const StarRating = ({ grade, size = "14px", showNumber = true }) => {
  const value = Number(grade) || 0;
  const outOfFive = value / 2;

  return (
    <HStack spacing={1} align="center">
      <HStack spacing={0.5}>
        {[0, 1, 2, 3, 4].map((i) => {
          const filled = outOfFive - i;
          const StarIcon =
            filled >= 1 ? FaStar : filled >= 0.5 ? FaStarHalfAlt : FaRegStar;
          return (
            <Icon
              key={i}
              as={StarIcon}
              boxSize={size}
              color={value ? "brand.400" : "text.muted"}
            />
          );
        })}
      </HStack>
      {showNumber && (
        <Text fontSize="sm" fontWeight="700" color={value ? "brand.400" : "text.muted"}>
          {value ? `${value}/10` : "Not rated"}
        </Text>
      )}
    </HStack>
  );
};

// Interactive 1-10 picker used in the create / edit forms.
export const RatingInput = ({ value, onChange }) => {
  const [hover, setHover] = useState(0);
  const current = hover || Number(value) || 0;

  return (
    <HStack spacing={1} flexWrap="wrap">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <Box
          key={n}
          as="button"
          type="button"
          aria-label={`Rate ${n} out of 10`}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n === Number(value) ? "" : n)}
          p={0.5}
          lineHeight={0}
          transition="transform 0.12s"
          _hover={{ transform: "scale(1.2)" }}
        >
          <Icon
            as={FaStar}
            boxSize="20px"
            color={n <= current ? "brand.400" : "whiteAlpha.400"}
          />
        </Box>
      ))}
      <Text ml={2} fontSize="sm" fontWeight="600" color="text.muted" minW="72px">
        {current ? `${current}/10` : "Tap to rate"}
      </Text>
    </HStack>
  );
};

export default StarRating;
