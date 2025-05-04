import { Container, VStack, Text, SimpleGrid, Input } from '@chakra-ui/react'
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMovieStore } from '../store/movie';
import MovieCard from '../components/MovieCard';
import AiSuggestBox from '../components/AiSuggestBox';

const HomePage = () => {
  const { fetchMovies: fetchMovies, movies: movies } = useMovieStore();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchMovies();
    }, [fetchMovies]);
    console.log("movies", movies);

    // Filter movies for search
    const filteredMovies = movies.filter(movie =>
      movie.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <Container maxW='container.xl' py={12}>
        <VStack spacing={8}>
          <Text
            fontSize={"30"}
            fontWeight={"bold"}
            textAlign={"center"}
            bgGradient={"linear(to-r, cyan.400, blue.500)"}
            bgClip={"text"}
          >
            Movies To Watch 🎬
          </Text>
        
          {/* search line*/}
          <Input
            placeholder="Search movies by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            maxW="400px"
          />
  
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={10} w='full'>
            {filteredMovies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </SimpleGrid>
  
          {filteredMovies.length === 0 && (
            <Text fontSize='xl' textAlign='center' fontWeight='bold' color='gray.500'>
              No matching movies found. Try a different search! 😢{" "}
              <Link to={"/create"}>
                <Text as='span' color='blue.500' _hover={{ textDecoration: 'underline' }}>
                  Add a new movie
                </Text>
              </Link>
            </Text>
          )}
  
          <AiSuggestBox />
        </VStack>
      </Container>
    );
  };

export default HomePage;