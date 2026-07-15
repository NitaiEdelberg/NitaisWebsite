import {
  Button,
  Container,
  HStack,
  Flex,
  Text,
  IconButton,
  useColorMode,
  Box,
  Tooltip,
} from "@chakra-ui/react";
import { Link, useNavigate } from "react-router-dom";
import { AddIcon } from "@chakra-ui/icons";
import { IoMoon } from "react-icons/io5";
import { LuSun } from "react-icons/lu";
import { useMovieStore } from "../store/movie";

const Navbar = () => {
  const { colorMode, toggleColorMode } = useColorMode();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const { logout } = useMovieStore();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <Box
      as="header"
      position="sticky"
      top={0}
      zIndex={100}
      bg="bg.canvas"
      borderBottom="1px solid"
      borderColor="border.subtle"
      backdropFilter="saturate(180%) blur(8px)"
    >
      <Container maxW="1140px" px={4}>
        <Flex h={16} alignItems="center" justifyContent="space-between">
          <Link to="/">
            <HStack spacing={2}>
              <Text fontSize="2xl" aria-hidden>🎬</Text>
              <Text
                fontFamily="heading"
                fontSize={{ base: "lg", sm: "xl" }}
                fontWeight="800"
                letterSpacing="tight"
                bgGradient="linear(to-r, brand.300, brand.500)"
                bgClip="text"
              >
                Nitai&apos;s Movie Library
              </Text>
            </HStack>
          </Link>

          <HStack spacing={2} alignItems="center">
            {token && (
              <Button
                as={Link}
                to="/create"
                colorScheme="brand"
                leftIcon={<AddIcon boxSize={3} />}
                size="sm"
                display={{ base: "none", sm: "inline-flex" }}
              >
                Add movie
              </Button>
            )}
            {token && (
              <Tooltip label="Add movie">
                <IconButton
                  as={Link}
                  to="/create"
                  colorScheme="brand"
                  aria-label="Add movie"
                  icon={<AddIcon />}
                  size="sm"
                  display={{ base: "inline-flex", sm: "none" }}
                />
              </Tooltip>
            )}

            {token ? (
              <Button variant="subtle" size="sm" onClick={handleLogout}>
                Log out
              </Button>
            ) : (
              <>
                <Button as={Link} to="/login" variant="subtle" size="sm">
                  Log in
                </Button>
                <Button
                  as={Link}
                  to="/register"
                  colorScheme="brand"
                  size="sm"
                  display={{ base: "none", sm: "inline-flex" }}
                >
                  Sign up
                </Button>
              </>
            )}

            <Tooltip label={colorMode === "light" ? "Dark mode" : "Light mode"}>
              <IconButton
                onClick={toggleColorMode}
                variant="subtle"
                size="sm"
                aria-label="Toggle color mode"
                icon={colorMode === "light" ? <IoMoon /> : <LuSun />}
              />
            </Tooltip>
          </HStack>
        </Flex>
      </Container>
    </Box>
  );
};

export default Navbar;
