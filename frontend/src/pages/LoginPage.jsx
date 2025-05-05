import { Button, Input, VStack, Heading, useToast } from '@chakra-ui/react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const toast = useToast();
  const navigate = useNavigate();

  //call api backend to login user
    //Post request to /api/auth/login
  const handleLogin = async () => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (data.success) {
      localStorage.setItem('token', data.token);
      toast({ title: "Logged in!", status: "success", isClosable: true });
      navigate('/');
    } else {
      toast({ title: "Login failed", description: data.message, status: "error", isClosable: true });
    }
  };

  return (
    <VStack spacing={4} mt={10}>
      <Heading>Login</Heading>
      <Input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <Input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
      <Button colorScheme="teal" onClick={handleLogin}>Login</Button>
    </VStack>
  );
};

export default LoginPage;
