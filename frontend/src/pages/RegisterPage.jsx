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
  FormHelperText,
  useToast,
  Link as ChakraLink,
  Container,
} from "@chakra-ui/react";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const RegisterPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const handleRegister = async () => {
    if (!email || !password) {
      toast({ title: "Enter an email and password.", status: "info", duration: 2500 });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password should be at least 6 characters.", status: "info", duration: 2500 });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Account created — please log in.", status: "success", isClosable: true, duration: 3000 });
        navigate("/login");
      } else {
        toast({ title: "Registration failed", description: data.message, status: "error", isClosable: true });
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
          <Text fontSize="3xl" aria-hidden>🍿</Text>
          <Heading size="lg">Create your library</Heading>
          <Text color="text.muted" fontSize="sm">
            Free forever. Start saving films in seconds.
          </Text>
        </VStack>
        <VStack spacing={4} as="form" onSubmit={(e) => { e.preventDefault(); handleRegister(); }}>
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
                autoComplete="new-password"
              />
              <InputRightElement width="4.5rem">
                <Button size="xs" variant="ghost" onClick={() => setShow((s) => !s)}>
                  {show ? "Hide" : "Show"}
                </Button>
              </InputRightElement>
            </InputGroup>
            <FormHelperText>At least 6 characters.</FormHelperText>
          </FormControl>
          <Button type="submit" colorScheme="brand" w="full" isLoading={loading} loadingText="Creating account">
            Create account
          </Button>
          <Text fontSize="sm" color="text.muted">
            Already have an account?{" "}
            <ChakraLink as={Link} to="/login" color="brand.400" fontWeight="600">
              Log in
            </ChakraLink>
          </Text>
        </VStack>
      </Box>
    </Container>
  );
};

export default RegisterPage;
