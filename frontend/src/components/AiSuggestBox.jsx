import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Input,
  Text,
  VStack,
  HStack
} from '@chakra-ui/react';

const AiSuggestBox = () => {
  const [input, setInput] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const getSuggestion = async () => {
    setLoading(true);
    const res = await fetch('/api/ai/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: input })
    });
    const data = await res.json();
    if (data.success) setSuggestion(data.recommendation || data.suggestion);
    else setSuggestion("No suggestion available.");
    setLoading(false);
  };

  const handleAddClick = () => {
    const titleMatch = suggestion.match(/Title:\s*(.*)/);
    const yearMatch = suggestion.match(/Year:\s*(.*)/);
    const noteMatch = suggestion.match(/Why you'll love it:\s*(.*)/);

    const movie = {
      name: titleMatch?.[1] || '',
      year: yearMatch?.[1] || '',
      image: '',
      note: noteMatch?.[1] || ''
    };

    localStorage.setItem("aiSuggestedMovie", JSON.stringify(movie));
    navigate("/create");
  };

  return (
    <Box mt={10} p={6} maxW="2xl" w="full" mx="auto" borderWidth="1px" borderRadius="lg" shadow="lg">
      <VStack spacing={3}>
        <Input
          placeholder="Describe the movie you want..."
          size="lg"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button colorScheme='teal' onClick={getSuggestion} isLoading={loading}>
          Get AI Recommendation
        </Button>

        {suggestion && (
          <Box mt={6} p={4} bg="gray.100" rounded="md" w="full">
            <Text whiteSpace="pre-line" mb={3}>{suggestion}</Text>
            <HStack>
          <Button colorScheme="blue" onClick={handleAddClick}>Add to my movies</Button>
          <Button colorScheme="purple" onClick={getSuggestion}>Suggest Different Movie</Button>
          <Button variant="ghost" onClick={() => setSuggestion('')}>Cancel</Button>
          </HStack>
          </Box>
        )}
      </VStack>
    </Box>
  );
};

export default AiSuggestBox;
