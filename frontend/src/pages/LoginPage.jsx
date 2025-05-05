import {Box,Button,Input,VStack,Heading,useToast,Text,useColorModeValue,Link as ChakraLink} from '@chakra-ui/react';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
  
const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const toast = useToast();
    const navigate = useNavigate();
  
    const handleLogin = async () => {
        //call api backend to login user
        //Post request to /api/auth/login
        const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
  
      if (data.success) {
        localStorage.setItem('token', data.token);
        toast({ title: "Logged in successfully!", status: "success", isClosable: true });
        navigate('/');
      } else {
        toast({ title: "Login failed", description: data.message, status: "error", isClosable: true });
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
        <Heading mb={6} textAlign="center">Login</Heading>
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
          <Button colorScheme="blue" w="full" onClick={handleLogin}>
            Login
          </Button>
          <Text fontSize="sm">
            Don't have an account?{" "}
            <ChakraLink as={Link} to="/register" color="blue.400">
              Register here
            </ChakraLink>
          </Text>
        </VStack>
      </Box>
    );
  };
  
export default LoginPage;
  



