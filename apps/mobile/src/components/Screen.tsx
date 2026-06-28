import type { PropsWithChildren, ReactNode, Ref } from "react";
import { ScrollView, StyleSheet, type ScrollViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

import { EnvironmentBanner } from "./EnvironmentBanner";

type ScreenProps = PropsWithChildren<{
  fixedContent?: ReactNode;
  onScroll?: ScrollViewProps["onScroll"];
  scrollEventThrottle?: ScrollViewProps["scrollEventThrottle"];
  scrollViewRef?: Ref<ScrollView>;
}>;

export function Screen({
  children,
  fixedContent,
  onScroll,
  scrollEventThrottle,
  scrollViewRef,
}: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      {fixedContent}
      <ScrollView
        contentContainerStyle={styles.content}
        onScroll={onScroll}
        ref={scrollViewRef}
        scrollEventThrottle={scrollEventThrottle}
        style={styles.scrollView}
      >
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
    position: "relative",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
  },
});
