import { extendTheme } from "@chakra-ui/react";

// ---------------------------------------------------------------------------
// Nitai's Movie Library — cinematic theme
// Dark-first (a movie library should feel like a dark theatre), with a warm
// "screening gold" accent reminiscent of film awards / IMDb ratings. Light
// mode is fully supported via semantic tokens so the toggle still looks great.
// ---------------------------------------------------------------------------

const config = {
  initialColorMode: "dark",
  useSystemColorMode: false,
};

const colors = {
  // Warm cinematic gold — used for the brand, ratings and primary actions.
  brand: {
    50: "#fff8e1",
    100: "#ffecb3",
    200: "#ffe082",
    300: "#ffd54f",
    400: "#ffca28",
    500: "#f5c518", // signature gold
    600: "#e0ad0a",
    700: "#b8890a",
    800: "#8f6a08",
    900: "#5c4405",
  },
  // Deep neutral surfaces for the dark theatre feel.
  ink: {
    900: "#0b0d12",
    850: "#0f121a",
    800: "#141824",
    750: "#191e2b",
    700: "#212739",
  },
};

const semanticTokens = {
  colors: {
    // Page background
    "bg.canvas": { default: "gray.50", _dark: "ink.900" },
    // Card / elevated surface
    "bg.surface": { default: "white", _dark: "ink.800" },
    "bg.surfaceHover": { default: "gray.50", _dark: "ink.750" },
    // Subtle inset (inputs, chips)
    "bg.muted": { default: "gray.100", _dark: "ink.750" },
    // Borders
    "border.subtle": { default: "gray.200", _dark: "whiteAlpha.200" },
    // Text
    "text.primary": { default: "gray.800", _dark: "gray.100" },
    "text.muted": { default: "gray.500", _dark: "gray.400" },
    // Accent
    accent: { default: "brand.600", _dark: "brand.500" },
  },
};

const fonts = {
  heading: `'Poppins', system-ui, -apple-system, 'Segoe UI', sans-serif`,
  body: `'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif`,
};

const styles = {
  global: (props) => ({
    "html, body, #root": {
      minHeight: "100%",
    },
    body: {
      bg: "bg.canvas",
      color: "text.primary",
      backgroundImage:
        props.colorMode === "dark"
          ? "radial-gradient(1200px 600px at 15% -10%, rgba(245,197,24,0.10), transparent 60%), radial-gradient(1000px 700px at 100% 0%, rgba(56,120,255,0.10), transparent 55%)"
          : "radial-gradient(1000px 600px at 15% -10%, rgba(245,197,24,0.14), transparent 60%), radial-gradient(900px 700px at 100% 0%, rgba(56,120,255,0.10), transparent 55%)",
      backgroundAttachment: "fixed",
    },
    "::selection": {
      background: "rgba(245,197,24,0.30)",
    },
  }),
};

const components = {
  Button: {
    baseStyle: { fontWeight: "600", borderRadius: "lg" },
    variants: {
      // Primary gold call-to-action.
      solid: (props) =>
        props.colorScheme === "brand"
          ? {
              bg: "brand.500",
              color: "gray.900",
              _hover: { bg: "brand.400", _disabled: { bg: "brand.500" } },
              _active: { bg: "brand.600" },
            }
          : {},
      subtle: {
        bg: "bg.muted",
        color: "text.primary",
        _hover: { bg: "bg.surfaceHover" },
      },
    },
  },
  Input: {
    defaultProps: { focusBorderColor: "brand.500" },
  },
  Textarea: {
    defaultProps: { focusBorderColor: "brand.500" },
  },
  NumberInput: {
    defaultProps: { focusBorderColor: "brand.500" },
  },
  Modal: {
    baseStyle: {
      dialog: { bg: "bg.surface" },
    },
  },
};

const theme = extendTheme({
  config,
  colors,
  semanticTokens,
  fonts,
  styles,
  components,
});

export default theme;
