import { Button, Container, HStack, Flex, Text, useColorMode, useColorModeValue } from '@chakra-ui/react'
import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PlusSquareIcon } from '@chakra-ui/icons'
import { IoMoon } from 'react-icons/io5'
import { LuSun } from 'react-icons/lu'

const Navbar = () => {
  const { colorMode, toggleColorMode } = useColorMode();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate(0); // reloads the page
  };

  return (
    <Container maxW={"1140px"} px={4} bg={useColorModeValue()}>
      <Flex
        h={16}
        alignItems={"center"}
        justifyContent={"space-between"}
        flexDir={{
          base: "column",
          sm: "row" 
        }}
      >
        <Text
          fontSize={{ base: "22", sm: "28"}}
          fontWeight={"bold"}
          textTransform={"uppercase"}
          textAlign={"center"}
          bgGradient={"linear(to-l, cyan.400, blue.500)"}
          bgClip={"text"}
        >
          <Link to={"/"}>Nitai's Movie List 🎬</Link>
        </Text>

        <HStack spacing={2} alignItems={"center"}>
          <Link to={"/create"}>
            <Button>
              <PlusSquareIcon fontSize={20} />
            </Button>
          </Link>

          {token ? (
            <Button colorScheme="red" onClick={handleLogout}>Logout</Button>
          ) : (
            <>
              <Link to="/login"><Button colorScheme="blue">Login</Button></Link>
              <Link to="/register"><Button colorScheme="green">Register</Button></Link>
            </>
          )}

          <Button onClick={toggleColorMode}>
            {colorMode === "light" ? <IoMoon /> : <LuSun size="20" />}
          </Button>
        </HStack>
      </Flex>
    </Container>
  );
};

export default Navbar;
