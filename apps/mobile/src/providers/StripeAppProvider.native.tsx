import { StripeProvider } from "@stripe/stripe-react-native";
import { type ReactElement } from "react";

type StripeAppProviderProps = {
  children: ReactElement | ReactElement[];
};

export function StripeAppProvider({ children }: StripeAppProviderProps) {
  const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

  return (
    <StripeProvider publishableKey={stripePublishableKey}>
      {children}
    </StripeProvider>
  );
}
