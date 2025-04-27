import { Box, Button, Container, Heading, Input, useColorModeValue, useToast, VStack } from '@chakra-ui/react';
import React, { useState } from 'react'
import { useMovieStore } from '../store/movie';

const CreatePage = () => {
  const [newMovie, setNewMovie] = useState({
    name: "",
    year: "",
    image: "",
    grade: "",
    note: ""
  });

  const toast = useToast()

const {createMovie} = useMovieStore()

  const handleAddMovie = async() => {
    const {success,message} = await createMovie(newMovie);
    if(!success) {
      toast({
        title: "Error",
        description: message,
        status: "error",
        isClosable: true
      })
    } else {
      toast({
        title: "success",
        description: message,
        status: "success",
        isClosable: true
      })
    }
    setNewMovie({
      name: "",
      year: "",
      image: ""
    })
  };

  return (
    <Container maxW={"container.sm"}>
        <VStack
          spacing={8}
        >
          <Heading as={"h1"} size={"2xl"} textAlign={"center"} mb={8}>
            Add New Movie to Watch
          </Heading>

          <Box
            w={"full"} bg={useColorModeValue("white", "gray.800")}
            p={6} rounded={"lg"} shadow={"md"}
          >

            <VStack spacing={4}>
            <Input 
              placeholder='Movie Title'
              name='name'
              value={newMovie.name}
              onChange={(e) => setNewMovie({ ...newMovie, name: e.target.value })}
              />
              <Input 
              placeholder='Release Year'
              name='year'
              type='number'
              min={1920}
              value={newMovie.year}
              onChange={(e) => setNewMovie({ ...newMovie, year: e.target.value })}
              />
              <Input 
              placeholder='Image URL'
              name='image'
              value={newMovie.image}
              onChange={(e) => setNewMovie({ ...newMovie, image: e.target.value })}
              />
              <Input 
              placeholder='Grade (1-10)'
              name='grade'
              type='number'
              min={1}
              max={10}
              value={newMovie.grade || ''}
              onChange={(e) => setNewMovie({ ...newMovie, grade: e.target.value })}
              />
              <Input 
              placeholder='Personal Note'
              name='note'
              value={newMovie.note || ''}
              onChange={(e) => setNewMovie({ ...newMovie, note: e.target.value })}
              />

            <Button colorScheme='blue' onClick={handleAddMovie} w='full'> 
               Add Movie
            </Button>

            </VStack>
          </Box>
        </VStack>
    </Container>
  );
};

export default CreatePage;