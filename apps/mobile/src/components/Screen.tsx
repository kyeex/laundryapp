import { PropsWithChildren, Ref } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

import { EnvironmentBanner } from "./EnvironmentBanner";

type ScreenProps = PropsWithChildren<{
  scrollViewRef?: Ref<ScrollView>;
}>;

export function Screen({ children, scrollViewRef }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} ref={scrollViewRef}>
        <EnvironmentBanner />
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
  },
});
