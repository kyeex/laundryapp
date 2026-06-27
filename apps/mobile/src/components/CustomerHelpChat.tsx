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
  "Pricing",
  "Add-ons",
  "Order notes",
  "Dry cleaning",
  "Care tips",
];

const welcomeMessage: ChatMessage = {
  id: "welcome",
  author: "assistant",
  text: "Hi, I am Laundry Guide. Ask me a quick question about your order.",
};

function getBasicAnswer(question: string) {
  const normalizedQuestion = question.toLowerCase();

  if (
    normalizedQuestion.includes("admin") ||
    normalizedQuestion.includes("owner") ||
    normalizedQuestion.includes("driver") ||
    normalizedQuestion.includes("dashboard") ||
    normalizedQuestion.includes("firebase") ||
    normalizedQuestion.includes("stripe") ||
    normalizedQuestion.includes("database") ||
    normalizedQuestion.includes("cloud") ||
    normalizedQuestion.includes("demo") ||
    normalizedQuestion.includes("staging") ||
    normalizedQuestion.includes("production") ||
    normalizedQuestion.includes("code") ||
    normalizedQuestion.includes("bug") ||
    normalizedQuestion.includes("login") ||
    normalizedQuestion.includes("sign in") ||
    normalizedQuestion.includes("password") ||
    normalizedQuestion.includes("button") ||
    normalizedQuestion.includes("page") ||
    normalizedQuestion.includes("screen") ||
    normalizedQuestion.includes("route") ||
    normalizedQuestion.includes("role") ||
    normalizedQuestion.includes("permission")
  ) {
    return "I can help with laundry service questions only. For account, app, or order-specific help, please contact the laundromat team.";
  }

  if (
    normalizedQuestion.includes("add-on") ||
    normalizedQuestion.includes("addon") ||
    normalizedQuestion.includes("washer") ||
    normalizedQuestion.includes("detergent") ||
    normalizedQuestion.includes("tide") ||
    normalizedQuestion.includes("sensitive") ||
    normalizedQuestion.includes("heat") ||
    normalizedQuestion.includes("blanket")
  ) {
    return "Choose add-ons for specific laundry needs: extra washing, detergent preference, drying heat, blankets, or comforters.";
  }

  if (
    normalizedQuestion.includes("note") ||
    normalizedQuestion.includes("instruction") ||
    normalizedQuestion.includes("tell") ||
    normalizedQuestion.includes("special")
  ) {
    return "Good laundry notes include stains, allergies, detergent preference, hang-dry items, separation requests, or pickup details.";
  }

  if (
    normalizedQuestion.includes("estimate") ||
    normalizedQuestion.includes("weight") ||
    normalizedQuestion.includes("pounds") ||
    normalizedQuestion.includes("lbs")
  ) {
    return "Estimate by bag size. A small bag may be 10-15 lb, while a full hamper may be 20-30 lb.";
  }

  if (
    normalizedQuestion.includes("price") ||
    normalizedQuestion.includes("cost") ||
    normalizedQuestion.includes("pound")
  ) {
    return "Wash and fold is estimated at $2 per pound with a 20 lb delivery minimum, plus selected add-ons, dry-cleaning items, comforters, and gratuity.";
  }

  if (
    normalizedQuestion.includes("minimum") ||
    normalizedQuestion.includes("20")
  ) {
    return "Delivery orders use a 20 lb minimum. If the laundry is under 20 lb, the laundry portion is still priced from the 20 lb minimum.";
  }

  if (
    normalizedQuestion.includes("dry") ||
    normalizedQuestion.includes("cleaning")
  ) {
    return "Dry cleaning is available with wash and fold plus dry cleaning. It is useful for dress shirts, dress pants, blazers, dresses, and delicate garments.";
  }

  if (
    normalizedQuestion.includes("delicate") ||
    normalizedQuestion.includes("shrink") ||
    normalizedQuestion.includes("wool") ||
    normalizedQuestion.includes("silk") ||
    normalizedQuestion.includes("hang") ||
    normalizedQuestion.includes("air dry")
  ) {
    return "For delicate items, request low heat or hang dry when possible. For dry-clean-only garments, choose wash and fold plus dry cleaning.";
  }

  if (
    normalizedQuestion.includes("stain") ||
    normalizedQuestion.includes("spot") ||
    normalizedQuestion.includes("wine") ||
    normalizedQuestion.includes("oil") ||
    normalizedQuestion.includes("sauce")
  ) {
    return "For stains, mention the item, stain type, and how fresh it is. Example: 'Blue shirt has coffee stain from today.'";
  }

  if (
    normalizedQuestion.includes("track") ||
    normalizedQuestion.includes("status") ||
    normalizedQuestion.includes("where")
  ) {
    return "For a specific order status, please check your order details or contact the laundromat team.";
  }

  if (
    normalizedQuestion.includes("pay") ||
    normalizedQuestion.includes("payment") ||
    normalizedQuestion.includes("card")
  ) {
    return "Payment is based on the final order total, including laundry weight, add-ons, dry-cleaning items, comforters, gratuity, and any approved adjustments.";
  }

  if (
    normalizedQuestion.includes("pickup") ||
    normalizedQuestion.includes("schedule")
  ) {
    return "Pickup and drop-off availability depends on the laundromat schedule, service area, and available time windows.";
  }

  if (
    normalizedQuestion.includes("preference") ||
    normalizedQuestion.includes("detergent") ||
    normalizedQuestion.includes("fold")
  ) {
    return "Share only the preferences that matter for the order, such as detergent, drying heat, folding, hang dry, or separation requests.";
  }

  return "I can help with laundry pricing, add-ons, dry cleaning, notes, pickup, payment basics, stains, and fabric care.";
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
        <Text style={styles.launcherText}>Chat</Text>
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
                <Text style={styles.chatTitle}>Laundry Guide</Text>
                <Text style={styles.chatSubtitle}>Quick order help</Text>
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
                placeholder="Ask a question"
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
    paddingHorizontal: spacing.lg,
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
    maxHeight: 560,
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
