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

type GuideCard = {
  id: string;
  title: string;
  body: string;
  prompts: string[];
};

const quickQuestions = [
  "Help me choose add-ons",
  "What should I put in notes?",
  "How should I estimate pounds?",
  "What should be dry cleaned?",
  "How do I protect delicate items?",
];

const guideCards: GuideCard[] = [
  {
    id: "order",
    title: "New order guide",
    body: "Choose wash and fold for everyday laundry. Choose wash and fold plus dry cleaning when you also have shirts, pants, dresses, or delicate garments that need special handling.",
    prompts: [
      "Which service should I choose?",
      "What should I put in notes?",
    ],
  },
  {
    id: "addons",
    title: "Add-on guide",
    body: "Use washer size add-ons for bulky loads, detergent add-ons for preference, heat add-ons for drying care, and comforter sizes for bedding.",
    prompts: [
      "Help me choose add-ons",
      "Which drying heat should I choose?",
    ],
  },
  {
    id: "care",
    title: "Laundry care guide",
    body: "Mention stains, delicate fabrics, color concerns, allergies, hang-dry requests, and anything that should not be dried with heat.",
    prompts: [
      "How do I protect delicate items?",
      "How should I handle stains?",
    ],
  },
  {
    id: "price",
    title: "Pricing guide",
    body: "The app estimates wash and fold by billable pounds, then adds selected add-ons, dry-cleaning items, comforters, and gratuity.",
    prompts: [
      "How is pricing calculated?",
      "What is the delivery minimum?",
    ],
  },
];

const welcomeMessage: ChatMessage = {
  id: "welcome",
  author: "assistant",
  text: "Hi, I am Laundry Buddy. I can help you choose services, add-ons, dry-cleaning items, notes, schedule details, and laundry care options before you place an order.",
};

function getBasicAnswer(question: string) {
  const normalizedQuestion = question.toLowerCase();

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
    return "Laundry Buddy guide: choose washer add-ons for oversized or extra-heavy loads, detergent add-ons when you have a preference, blanket/comforter options for bedding, and low heat for delicate items. Medium or high heat is best only when you are comfortable with normal machine drying.";
  }

  if (
    normalizedQuestion.includes("note") ||
    normalizedQuestion.includes("instruction") ||
    normalizedQuestion.includes("tell") ||
    normalizedQuestion.includes("special")
  ) {
    return "A good order note should mention stains, allergies, detergent preference, items to hang dry, items to separate, pickup details, pets/gate codes, or anything delicate. Example: 'Please separate whites, use sensitive detergent, hang dry workout shirts, and text on arrival.'";
  }

  if (
    normalizedQuestion.includes("estimate") ||
    normalizedQuestion.includes("weight") ||
    normalizedQuestion.includes("pounds") ||
    normalizedQuestion.includes("lbs")
  ) {
    return "To estimate pounds, think in laundry bags: a small bag may be around 10-15 lb, a full tall hamper may be 20-30 lb, and bedding can add more. The app uses the business minimum when the estimate is below the delivery minimum, and the owner confirms final pricing after pickup.";
  }

  if (
    normalizedQuestion.includes("price") ||
    normalizedQuestion.includes("cost") ||
    normalizedQuestion.includes("pound")
  ) {
    return "Wash and fold is estimated by billable pounds, plus any selected add-ons, dry-cleaning items, comforters, and gratuity. The owner confirms the final price after pickup and review.";
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
    return "Dry cleaning can be added only with the combined wash and fold plus dry cleaning service. Good dry-cleaning candidates include dress shirts, dress pants, blazers, dresses, and delicate garments. Stand-alone dry cleaning delivery is not offered in this app.";
  }

  if (
    normalizedQuestion.includes("delicate") ||
    normalizedQuestion.includes("shrink") ||
    normalizedQuestion.includes("wool") ||
    normalizedQuestion.includes("silk") ||
    normalizedQuestion.includes("hang") ||
    normalizedQuestion.includes("air dry")
  ) {
    return "For delicate items, write a clear note and choose low heat when available. For wool, silk, structured garments, embellished clothing, or items labeled dry clean only, use wash and fold plus dry cleaning and list the items clearly.";
  }

  if (
    normalizedQuestion.includes("stain") ||
    normalizedQuestion.includes("spot") ||
    normalizedQuestion.includes("wine") ||
    normalizedQuestion.includes("oil") ||
    normalizedQuestion.includes("sauce")
  ) {
    return "For stains, add a note with the item, stain type, and how fresh it is. Example: 'Blue shirt has coffee stain from today.' Avoid drying stained items before cleaning because heat can set stains.";
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
    return "Pickup and drop-off dates are shown on the New Order page. The owner controls available days and time windows. Choose the window where the order can actually be reached at the customer address.";
  }

  if (
    normalizedQuestion.includes("preference") ||
    normalizedQuestion.includes("detergent") ||
    normalizedQuestion.includes("fold")
  ) {
    return "For now, each new order should have fresh notes. Add the preferences that matter for this order, such as detergent, heat level, folding, hang dry, or separation requests.";
  }

  return "Laundry Buddy can help with pricing, minimums, pickup scheduling, add-ons, dry cleaning, detergent, drying heat, comforters, stains, order notes, payment, and tracking. Try asking: 'What should I put in notes?' or 'Help me choose add-ons.'";
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
                <Text style={styles.chatTitle}>Laundry Buddy</Text>
                <Text style={styles.chatSubtitle}>Order guide and laundry care helper</Text>
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

            <View style={styles.guideGrid}>
              {guideCards.map((guide) => (
                <View key={guide.id} style={styles.guideCard}>
                  <Text style={styles.guideTitle}>{guide.title}</Text>
                  <Text style={styles.guideBody}>{guide.body}</Text>
                  <View style={styles.guidePromptRow}>
                    {guide.prompts.map((prompt) => (
                      <Pressable
                        key={prompt}
                        onPress={() => sendMessage(prompt)}
                        style={styles.guidePromptButton}
                      >
                        <Text style={styles.guidePromptText}>{prompt}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
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
                placeholder="Ask Laundry Buddy"
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
    maxHeight: 720,
    maxWidth: 560,
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
  guideGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  guideCard: {
    backgroundColor: "#F0FDFA",
    borderColor: "#99F6E4",
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: 230,
    flexGrow: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  guideTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  guideBody: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  guidePromptRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  guidePromptButton: {
    backgroundColor: colors.surface,
    borderColor: "#99F6E4",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  guidePromptText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
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
