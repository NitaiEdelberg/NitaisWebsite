import { Box, Button, Heading, HStack, IconButton, Image, Input, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Text, useColorModeValue, useDisclosure, useToast, VStack } from '@chakra-ui/react';
import { DeleteIcon, EditIcon } from '@chakra-ui/icons';
import React, { useState } from 'react'
import { useMovieStore } from '../store/movie';

const MovieCard = ({movie}) => {
    const [updatedMovie, setUpdatedMovie] = useState(movie);
    const textColor = useColorModeValue('gray.600', 'gray.200');
    const bg=useColorModeValue('white', 'gray.800');

    const { deleteMovie, updateMovie } = useMovieStore();
    const toast = useToast();
    const {isOpen, onOpen, onClose} = useDisclosure();

    const handleDeleteMovie = async (pid) => {
        const {success, message} = await deleteMovie(pid);
        if(!success) {
            toast({
                title: "Error",
                description: message,
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        } else {
            toast({
                title: "Success",
                description: message,
                status: "success",
                duration: 3000,
                isClosable: true,
            });
        }
    }

    const handleUpdateMovie = async (pid, updatedMovie) => {
        const {success, message} = await updateMovie(pid, updatedMovie);
        onClose();
        if(!success) {
            toast({
                title: "Error",
                description: message,
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        } else {
            toast({
                title: "movie Updated Successfully",
                description: message,
                status: "success",
                duration: 3000,
                isClosable: true,
            });
        };
    }
  return (
    <Box
    shadow='lg'
    rounded={'lg'}
    overflow='hidden'
    transition='all 0.3s'
    _hover={{ transform: "translateY(-5px)", shadow: 'xl' }}
    bg={bg}
    >
        <Image src={movie.image} alt={movie.name} h={48} w='full' objectFit='cover' />

        <Box p={4}>
            <Heading as='h3' size='md' mb={2}>
                {movie.name}({movie.year})
            </Heading>
            <Text fontWeight='bold' fontSize='xl' color={textColor} mb={4}>
            Grade: {movie.grade ? movie.grade + "/10" : "Not rated yet."}
            </Text>
            <Text color={textColor} mb={4}>
                {movie.note || "No note yet."}
            </Text>
            <HStack spacing={2}>
                <IconButton icon={<EditIcon />} onClick={onOpen} colorScheme='blue'/>
                <IconButton icon={<DeleteIcon />} onClick={() => handleDeleteMovie(movie._id)} colorScheme='red'/>
            </HStack>
        </Box>

        <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />

            <ModalContent>
                <ModalHeader>Update movie</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    <VStack spacing={4}>
                        <Input placeholder='movie Name' name='name' value={updatedMovie.name} onChange={(e) => setUpdatedMovie({...updatedMovie,name: e.target.value})}/>
                        <Input placeholder='Release Year' name='year' value={updatedMovie.year} onChange={(e) => setUpdatedMovie({...updatedMovie,year: e.target.value})}/>
                        <Input placeholder='Poster Image URL' name='image' value={updatedMovie.image} onChange={(e) => setUpdatedMovie({...updatedMovie,image: e.target.value})} />
                        <Input placeholder='Grade (1-10)' name='grade' type='number' min={1} max={10} value={updatedMovie.grade || ''} onChange={(e) => setUpdatedMovie({ ...updatedMovie, grade: e.target.value })} />
                        <Input placeholder='Personal Note' name='note' value={updatedMovie.note || ''} onChange={(e) => setUpdatedMovie({ ...updatedMovie, note: e.target.value })} />
                    </VStack>
                </ModalBody>
                <ModalFooter>
                    <Button colorScheme='blue' mr={3} onClick={() => handleUpdateMovie(movie._id, updatedMovie)}>
                        update
                    </Button>
                    <Button variant='ghost' onClick={onClose}>
                        Cancel
                    </Button>
                </ModalFooter>

            </ModalContent>

        </Modal>
    </Box>
  )
}

export default MovieCard;