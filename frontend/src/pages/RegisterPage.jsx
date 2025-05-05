import { Button, Input, VStack, Heading, useToast } from '@chakra-ui/react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const RegisterPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const toast = useToast();
  const navigate = useNavigate();

  //call api backend to register user
  //Post request to /api/auth/register
  const handleRegister = async () => {
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
    <VStack spacing={4} mt={10}>
      <Heading>Register</Heading>
      <Input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <Input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
      <Button colorScheme="blue" onClick={handleRegister}>Register</Button>
    </VStack>
  );
};

export default RegisterPage;
