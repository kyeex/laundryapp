import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

type ChatMessage = {
  id: string;
  author: "assistant" | "customer";
  text: string;
};

const quickQuestions = [
  "How is pricing calculated?",
  "What is the delivery minimum?",
  "Can I add dry cleaning?",
  "How do I track my order?",
  "When do I pay?",
];

const welcomeMessage: ChatMessage = {
  id: "welcome",
  author: "assistant",
  text: "Hi, I can answer basic questions about pricing, pickups, dry cleaning, payment, and order tracking.",
};

function getBasicAnswer(question: string) {
  const normalizedQuestion = question.toLowerCase();

  if (
    normalizedQuestion.includes("price") ||
    normalizedQuestion.includes("cost") ||
    normalizedQuestion.includes("pound")
  ) {
    return "Wash and fold is estimated by pounds, plus any selected add-ons, dry-cleaning items, comforters, and gratuity. The owner confirms the final price after the order is reviewed.";
  }

  if (
    normalizedQuestion.includes("minimum") ||
    normalizedQuestion.includes("20")
  ) {
    return "Delivery orders use the business delivery minimum. If the laundry estimate is below the minimum, the minimum weight is still used for the laundry price.";
  }

  if (
    normalizedQuestion.includes("dry") ||
    normalizedQuestion.includes("cleaning")
  ) {
    return "Dry cleaning can be added only with the combined wash and fold plus dry cleaning service. Stand-alone dry cleaning delivery is not offered in this app.";
  }

  if (
    normalizedQuestion.includes("track") ||
    normalizedQuestion.includes("status") ||
    normalizedQuestion.includes("where")
  ) {
    return "Open My Orders, select the order, then use Track order status to see the timeline from requested through completed.";
  }

  if (
    normalizedQuestion.includes("pay") ||
    normalizedQuestion.includes("payment") ||
    normalizedQuestion.includes("card")
  ) {
    return "Payment is handled after the owner confirms the final price. Demo payment screens do not process real cards until Stripe is fully connected.";
  }

  if (
    normalizedQuestion.includes("pickup") ||
    normalizedQuestion.includes("schedule")
  ) {
    return "Pickup dates and windows are shown on the New Order page. The owner controls which days and windows are available.";
  }

  if (
    normalizedQuestion.includes("preference") ||
    normalizedQuestion.includes("detergent") ||
    normalizedQuestion.includes("fold")
  ) {
    return "You can save laundry preferences from Customer Preferences. Those notes can populate future orders.";
  }

  return "I can help with basic questions about pricing, minimums, pickup scheduling, dry cleaning, payment, and tracking. For anything specific, contact the laundromat directly.";
}

export function CustomerHelpChat() {
  const { currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);

  const shouldShowChat = currentUser?.role === "customer";
  const quickQuestionButtons = useMemo(() => quickQuestions, []);

  if (!shouldShowChat) {
    return null;
  }

  function sendMessage(text: string) {
    const trimmedText = text.trim();

    if (!trimmedText) {
      return;
    }

    const timestamp = Date.now();
    setMessages((current) => [
      ...current,
      {
        id: `customer-${timestamp}`,
        author: "customer",
        text: trimmedText,
      },
      {
        id: `assistant-${timestamp}`,
        author: "assistant",
        text: getBasicAnswer(trimmedText),
      },
    ]);
    setDraft("");
  }

  return (
    <>
      <Pressable
        accessibilityLabel="Open help chat"
        accessibilityRole="button"
        onPress={() => setIsOpen(true)}
        style={styles.launcher}
      >
        <Text style={styles.launcherText}>Help</Text>
      </Pressable>
      <Modal
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
        transparent
        visible={isOpen}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.chatPanel}>
            <View style={styles.chatHeader}>
              <View style={styles.chatHeaderCopy}>
                <Text style={styles.chatTitle}>Laundry help</Text>
                <Text style={styles.chatSubtitle}>Basic customer questions</Text>
              </View>
              <Pressable
                accessibilityLabel="Close help chat"
                accessibilityRole="button"
                onPress={() => setIsOpen(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>X</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.messages}>
              {messages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    styles.messageBubble,
                    message.author === "customer"
                      ? styles.customerBubble
                      : styles.assistantBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      message.author === "customer" && styles.customerMessageText,
                    ]}
                  >
                    {message.text}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.quickQuestions}>
              {quickQuestionButtons.map((question) => (
                <Pressable
                  key={question}
                  onPress={() => sendMessage(question)}
                  style={styles.quickQuestionButton}
                >
                  <Text style={styles.quickQuestionText}>{question}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.inputRow}>
              <TextInput
                onChangeText={setDraft}
                onSubmitEditing={() => sendMessage(draft)}
                placeholder="Ask a basic question"
                placeholderTextColor={colors.muted}
                returnKeyType="send"
                style={styles.input}
                value={draft}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => sendMessage(draft)}
                style={styles.sendButton}
              >
                <Text style={styles.sendButtonText}>Send</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  launcher: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    bottom: spacing.lg,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.md,
    position: "absolute",
    right: spacing.lg,
  },
  launcherText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  modalOverlay: {
    alignItems: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.34)",
    flex: 1,
    justifyContent: "flex-end",
    padding: spacing.lg,
  },
  chatPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    maxHeight: 620,
    maxWidth: 420,
    padding: spacing.md,
    width: "100%",
  },
  chatHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  chatHeaderCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  chatTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  chatSubtitle: {
    color: colors.muted,
    fontSize: 13,
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  closeButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  messages: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  messageBubble: {
    borderRadius: 8,
    maxWidth: "88%",
    padding: spacing.sm,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#F8FAFC",
  },
  customerBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
  },
  messageText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  customerMessageText: {
    color: colors.onPrimary,
  },
  quickQuestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  quickQuestionButton: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  quickQuestionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  inputRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  sendButtonText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
});
