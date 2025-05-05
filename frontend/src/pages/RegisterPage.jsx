import {Box,Button,Input,VStack,Heading,useToast,Text,useColorModeValue,Link as ChakraLink} from '@chakra-ui/react';
  import { useState } from 'react';
  import { useNavigate, Link } from 'react-router-dom';
  
  const RegisterPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const toast = useToast();
    const navigate = useNavigate();
  
    const handleRegister = async () => {
        //call api backend to register user
        //Post request to /api/auth/register
        const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
  
      if (data.success) {
        toast({ title: "Registered successfully!", status: "success", isClosable: true });
        navigate('/login');
      } else {
        toast({ title: "Registration failed", description: data.message, status: "error", isClosable: true });
      }
    };
  
    return (
      <Box
        maxW="md"
        mx="auto"
        mt={20}
        p={8}
        borderWidth={1}
        borderRadius="lg"
        boxShadow="lg"
        bg={useColorModeValue("white", "gray.800")}
      >
        <Heading mb={6} textAlign="center">Register</Heading>
        <VStack spacing={4}>
          <Input
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <Input
            placeholder="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <Button colorScheme="blue" w="full" onClick={handleRegister}>
            Create Account
          </Button>
          <Text fontSize="sm">
            Already have an account?{" "}
            <ChakraLink as={Link} to="/login" color="blue.400">
              Login here
            </ChakraLink>
          </Text>
        </VStack>
      </Box>
    );
  };
  
  export default RegisterPage;
  




