import { useState } from 'react';
import { Box, Button, Input, Text, VStack } from '@chakra-ui/react';

const AiSuggestBox = () => {
  const [input, setInput] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(false);

  const getSuggestion = async () => {
    setLoading(true);
    const res = await fetch('/api/ai/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: input })
    });
    const data = await res.json();
    if (data.success) setSuggestion(data.suggestion);
    else setSuggestion("No suggestion available.");
    setLoading(false);
  };

  return (
    <Box mt={8} p={4} shadow='md' borderWidth='1px' borderRadius='md'>
      <VStack spacing={3}>
        <Input 
          placeholder="Describe what kind of movie you want..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button colorScheme='teal' onClick={getSuggestion} isLoading={loading}>
          Get AI Recommendation
        </Button>
        {suggestion && <Text fontWeight='bold' color='blue.500'>{suggestion}</Text>}
      </VStack>
    </Box>
  );
};

export default AiSuggestBox;
