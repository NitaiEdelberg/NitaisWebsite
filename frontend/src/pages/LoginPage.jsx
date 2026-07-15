import {
  Box,
  Button,
  Input,
  InputGroup,
  InputRightElement,
  VStack,
  Heading,
  Text,
  FormControl,
  FormLabel,
  useToast,
  Link as ChakraLink,
  Container,
} from "@chakra-ui/react";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!email || !password) {
      toast({ title: "Enter your email and password.", status: "info", duration: 2500 });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("token", data.token);
        toast({ title: "Welcome back!", status: "success", isClosable: true, duration: 2500 });
        navigate("/");
      } else {
        toast({ title: "Login failed", description: data.message, status: "error", isClosable: true });
      }
    } catch {
      toast({ title: "Could not reach the server", status: "error", isClosable: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxW="md" py={{ base: 12, md: 20 }}>
      <Box
        p={{ base: 6, md: 8 }}
        borderWidth={1}
        borderColor="border.subtle"
        borderRadius="2xl"
        boxShadow="xl"
        bg="bg.surface"
      >
        <VStack spacing={2} mb={6} textAlign="center">
          <Text fontSize="3xl" aria-hidden>🎬</Text>
          <Heading size="lg">Welcome back</Heading>
          <Text color="text.muted" fontSize="sm">
            Log in to see your movie library.
          </Text>
        </VStack>
        <VStack spacing={4} as="form" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
          <FormControl isRequired>
            <FormLabel fontSize="sm">Email</FormLabel>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </FormControl>
          <FormControl isRequired>
            <FormLabel fontSize="sm">Password</FormLabel>
            <InputGroup>
              <Input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <InputRightElement width="4.5rem">
                <Button size="xs" variant="ghost" onClick={() => setShow((s) => !s)}>
                  {show ? "Hide" : "Show"}
                </Button>
              </InputRightElement>
            </InputGroup>
          </FormControl>
          <Button type="submit" colorScheme="brand" w="full" isLoading={loading} loadingText="Logging in">
            Log in
          </Button>
          <Text fontSize="sm" color="text.muted">
            Don&apos;t have an account?{" "}
            <ChakraLink as={Link} to="/register" color="brand.400" fontWeight="600">
              Sign up
            </ChakraLink>
          </Text>
        </VStack>
      </Box>
    </Container>
  );
};

export default LoginPage;
