import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "expo-dev-client";
import { Stack } from "expo-router";
import React from "react";

// Create a client
const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Stack
        screenOptions={{
          headerBackButtonDisplayMode: "minimal",
          headerTitle: "",
          //   headerTransparent: true, // If set to true, navigation is not properly working on iPhone 7 iOS 15.8.4
        }}
      />
    </QueryClientProvider>
  );
}
