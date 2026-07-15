import { render } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { MemoryRouter } from "react-router-dom";
import theme from "../theme";

// Renders a component inside the providers the app relies on.
export function renderWithProviders(ui, { route = "/" } = {}) {
  return render(
    <ChakraProvider theme={theme}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </ChakraProvider>
  );
}

export function mockFetchOnce(body, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  });
}
