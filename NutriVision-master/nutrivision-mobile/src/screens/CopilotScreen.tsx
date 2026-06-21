import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { getToken } from "../utils/auth";
import { BASE_URL } from "../utils/api";

const { width: SCREEN_W } = Dimensions.get("window");
const API_BASE = BASE_URL || "http://localhost:8000";

// ─── Types ───────────────────────────

type MessageRole = "user" | "assistant" | "system";

type FoodCard = {
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  serving: string;
  reason: string;
};

type LogMeal = {
  food_name: string;
  quantity: number;
  weight_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
};

type Message = {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  foodCard?: FoodCard;
  logMeal?: LogMeal;
  isStreaming?: boolean;
  logConfirmed?: boolean;
};

// ─── Quick suggestion chips ──────────

const QUICK_SUGGESTIONS = [
  "What should I eat for lunch?",
  "I had 2 idlis for breakfast",
  "What's my protein deficit today?",
  "Suggest a high-protein dinner",
  "Am I on track today?",
  "Give me a Tamil Nadu dinner idea",
];

// ─── Parse AI response for cards ─────

function parseResponse(raw: string): {
  text: string;
  foodCard?: FoodCard;
  logMeal?: LogMeal;
} {
  let text = raw;
  let foodCard: FoodCard | undefined;
  let logMeal: LogMeal | undefined;
  
  // Extract food card
  const cardMatch = raw.match(
    /\|\|\|FOOD_CARD\|\|\|([\s\S]*?)\|\|\|END_CARD\|\|\|/
  );
  if (cardMatch) {
    try {
      foodCard = JSON.parse(cardMatch[1].trim());
    } catch {}
    text = text.replace(cardMatch[0], "").trim();
  }
  
  // Extract log meal
  const logMatch = raw.match(
    /\|\|\|LOG_MEAL\|\|\|([\s\S]*?)\|\|\|END_LOG\|\|\|/
  );
  if (logMatch) {
    try {
      logMeal = JSON.parse(logMatch[1].trim());
    } catch {}
    text = text.replace(logMatch[0], "").trim();
  }
  
  return { text, foodCard, logMeal };
}

// ─── Food Card Component ──────────────

function FoodCardComponent({
  card,
  onLog,
}: {
  card: FoodCard;
  onLog: () => void;
}) {
  return (
    <View style={styles.foodCard}>
      <View style={styles.foodCardHeader}>
        <Text style={styles.foodCardName}>
          {card.food_name}
        </Text>
        <Text style={styles.foodCardServing}>
          {card.serving}
        </Text>
      </View>
      
      <View style={styles.foodCardMacros}>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>
            {card.calories}
          </Text>
          <Text style={styles.macroLabel}>
            kcal
          </Text>
        </View>
        <View style={styles.macroItem}>
          <Text style={[styles.macroValue, { color: "#1D9E75" }]}>
            {card.protein_g}g
          </Text>
          <Text style={styles.macroLabel}>
            protein
          </Text>
        </View>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>
            {card.carbs_g}g
          </Text>
          <Text style={styles.macroLabel}>
            carbs
          </Text>
        </View>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>
            {card.fats_g}g
          </Text>
          <Text style={styles.macroLabel}>
            fats
          </Text>
        </View>
      </View>
      
      {card.reason ? (
        <Text style={styles.foodCardReason}>
          {card.reason}
        </Text>
      ) : null}
      
      <TouchableOpacity
        style={styles.logFoodBtn}
        onPress={onLog}
      >
        <Text style={styles.logFoodBtnText}>
          + Log this meal
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Message Bubble Component ─────────

function MessageBubble({
  message,
  onLogMeal,
  onConfirmLog,
}: {
  message: Message;
  onLogMeal: (meal: LogMeal) => void;
  onConfirmLog: (msgId: string) => void;
}) {
  const isUser = message.role === "user";
  
  return (
    <View style={[
      styles.messageWrapper,
      isUser ? styles.messageWrapperUser : styles.messageWrapperBot
    ]}>
      
      {/* Main bubble */}
      {message.content.trim() !== "" && (
        <View style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleBot
        ]}>
          <Text style={[
            styles.bubbleText,
            isUser ? styles.bubbleTextUser : styles.bubbleTextBot
          ]}>
            {message.content}
            {message.isStreaming && (
              <Text style={styles.cursor}>
                {" ▋"}
              </Text>
            )}
          </Text>
        </View>
      )}
      
      {/* Food recommendation card */}
      {message.foodCard && (
        <FoodCardComponent
          card={message.foodCard}
          onLog={() => {
            const meal: LogMeal = {
              food_name: message.foodCard!.food_name,
              quantity: 1,
              weight_g: 100,
              calories: message.foodCard!.calories,
              protein_g: message.foodCard!.protein_g,
              carbs_g: message.foodCard!.carbs_g,
              fats_g: message.foodCard!.fats_g,
            };
            onLogMeal(meal);
          }}
        />
      )}
      
      {/* Meal log confirmation */}
      {message.logMeal && !message.logConfirmed && (
        <View style={styles.logConfirmCard}>
          <Text style={styles.logConfirmTitle}>
            Log this meal?
          </Text>
          <Text style={styles.logConfirmFood}>
            {message.logMeal.food_name} · {message.logMeal.calories} kcal · {message.logMeal.protein_g}g protein
          </Text>
          <View style={styles.logConfirmBtns}>
            <TouchableOpacity
              style={styles.logYesBtn}
              onPress={() => {
                onLogMeal(message.logMeal!);
                onConfirmLog(message.id);
              }}
            >
              <Text style={styles.logYesText}>
                Yes, log it
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.logNoBtn}
              onPress={() => onConfirmLog(message.id)}
            >
              <Text style={styles.logNoText}>
                No thanks
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {message.logConfirmed && message.logMeal && (
        <View style={styles.loggedBadge}>
          <Text style={styles.loggedBadgeText}>
            ✓ {message.logMeal.food_name} logged
          </Text>
        </View>
      )}
      
      <Text style={styles.timestamp}>
        {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────

export default function CopilotScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I'm your NutriVision AI nutrition assistant. I know your nutrition goals, diet preferences, and what you've eaten today.\n\nAsk me anything — what to eat, how to hit your protein goal, or just tell me what you had for lunch!",
      timestamp: new Date(),
    }
  ]);
  
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  
  const listRef = useRef<FlatList>(null);
  
  // Scroll to bottom on new message
  useEffect(() => {
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);
  
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    
    setShowSuggestions(false);
    setInput("");
    setIsLoading(true);
    
    // Add user message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    
    // Add placeholder for streaming response
    const assistantMsgId = (Date.now() + 1).toString();
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    };
    
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    
    try {
      const token = await getToken();
      
      // Build conversation history
      // (exclude welcome and current streaming)
      const history = messages
        .filter(m => m.id !== "welcome" && !m.isStreaming)
        .slice(-10)
        .map(m => ({
          role: m.role,
          content: m.content,
        }));
      
      let fullText = "";
      let seenBytes = 0;
      let buffer = "";
      
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/api/copilot/chat`);
      xhr.setRequestHeader("Content-Type", "application/json");
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }
      
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 3 || xhr.readyState === 4) {
          const newText = xhr.responseText.slice(seenBytes);
          seenBytes = xhr.responseText.length;
          buffer += newText;
          
          let lineIndex = buffer.indexOf("\n");
          while (lineIndex !== -1) {
            const line = buffer.slice(0, lineIndex).trim();
            buffer = buffer.slice(lineIndex + 1);
            
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.done) {
                  // Done stream received
                } else if (data.text) {
                  fullText += data.text;
                  setMessages(prev => prev.map(m =>
                    m.id === assistantMsgId
                      ? { ...m, content: fullText }
                      : m
                  ));
                }
              } catch (e) {
                // Ignore incomplete JSON lines
              }
            }
            lineIndex = buffer.indexOf("\n");
          }
        }
        
        if (xhr.readyState === 4) {
          setIsLoading(false);
          if (xhr.status >= 200 && xhr.status < 300) {
            const parsed = parseResponse(fullText);
            setMessages(prev => prev.map(m =>
              m.id === assistantMsgId ? {
                ...m,
                content: parsed.text,
                foodCard: parsed.foodCard,
                logMeal: parsed.logMeal,
                isStreaming: false,
              } : m
            ));
          } else {
            setMessages(prev => prev.map(m =>
              m.id === assistantMsgId ? {
                ...m,
                content: "Sorry, I couldn't connect to the AI service. Please check your network and try again.",
                isStreaming: false,
              } : m
            ));
          }
        }
      };
      
      xhr.onerror = () => {
        setIsLoading(false);
        setMessages(prev => prev.map(m =>
          m.id === assistantMsgId ? {
            ...m,
            content: "Network connection error. Please try again.",
            isStreaming: false,
          } : m
        ));
      };
      
      xhr.send(JSON.stringify({
        message: text.trim(),
        conversation_history: history,
      }));
      
    } catch (error) {
      setIsLoading(false);
      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId ? {
          ...m,
          content: "Sorry, an unexpected error occurred. Please try again.",
          isStreaming: false,
        } : m
      ));
    }
  }, [messages, isLoading]);
  
  const logMeal = useCallback(async (meal: LogMeal) => {
    try {
      const token = await getToken();
      
      const response = await fetch(`${API_BASE}/api/copilot/log-meal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(meal),
      });
      
      if (!response.ok) {
        throw new Error();
      }
      
      // Add confirmation message
      const confirmMsg: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `✓ ${meal.food_name} has been logged! ${meal.calories} kcal and ${meal.protein_g}g protein added to your daily tracker.`,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, confirmMsg]);
      
    } catch {
      const errMsg: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: "Could not log the meal right now. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    }
  }, []);
  
  const confirmLog = useCallback((msgId: string) => {
    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, logConfirmed: true } : m
    ));
  }, []);
  
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          🤖 AI Nutrition Copilot
        </Text>
        <Text style={styles.headerSub}>
          Powered by your nutrition data
        </Text>
      </View>
      
      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.messageList}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            onLogMeal={logMeal}
            onConfirmLog={confirmLog}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
      
      {/* Quick suggestions */}
      {showSuggestions && (
        <View style={styles.suggestions}>
          <Text style={styles.suggestionsLabel}>
            Try asking:
          </Text>
          <View style={styles.suggestionChips}>
            {QUICK_SUGGESTIONS.map((s, i) => (
              <TouchableOpacity
                key={i}
                style={styles.chip}
                onPress={() => sendMessage(s)}
              >
                <Text style={styles.chipText}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      
      {/* Typing indicator */}
      {isLoading && (
        <View style={styles.typingIndicator}>
          <ActivityIndicator size="small" color="#1D9E75" />
          <Text style={styles.typingText}>
            AI is thinking...
          </Text>
        </View>
      )}
      
      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask about nutrition or log a meal..."
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={500}
          onFocus={() => setShowSuggestions(false)}
          returnKeyType="send"
          onSubmitEditing={() => sendMessage(input)}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!input.trim() || isLoading) && styles.sendBtnDisabled
          ]}
          onPress={() => sendMessage(input)}
          disabled={!input.trim() || isLoading}
        >
          <Text style={styles.sendBtnText}>
            ➤
          </Text>
        </TouchableOpacity>
      </View>
      
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#F8FAF9" 
  },
  header: {
    backgroundColor: "#fff",
    paddingTop: 56,
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  headerSub: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  messageList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageWrapper: {
    marginBottom: 16,
    maxWidth: SCREEN_W * 0.85,
  },
  messageWrapperUser: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  messageWrapperBot: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  bubble: {
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  bubbleUser: {
    backgroundColor: "#1D9E75",
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    borderWidth: 0.5,
    borderColor: "#E5E7EB",
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  bubbleTextUser: { color: "#fff" },
  bubbleTextBot: { color: "#1A1A1A" },
  cursor: {
    color: "#1D9E75",
    fontWeight: "bold",
  },
  timestamp: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 2,
  },
  foodCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#1D9E7530",
    width: SCREEN_W * 0.75,
  },
  foodCardHeader: {
    marginBottom: 10,
  },
  foodCardName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  foodCardServing: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  foodCardMacros: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    backgroundColor: "#F8FAF9",
    borderRadius: 8,
    padding: 10,
  },
  macroItem: { alignItems: "center" },
  macroValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  macroLabel: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 1,
  },
  foodCardReason: {
    fontSize: 12,
    color: "#6B7280",
    fontStyle: "italic",
    marginBottom: 10,
    lineHeight: 18,
  },
  logFoodBtn: {
    backgroundColor: "#1D9E75",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  logFoodBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  logConfirmCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    width: SCREEN_W * 0.75,
  },
  logConfirmTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  logConfirmFood: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 12,
  },
  logConfirmBtns: {
    flexDirection: "row",
    gap: 8,
  },
  logYesBtn: {
    flex: 1,
    backgroundColor: "#1D9E75",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  logYesText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  logNoBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  logNoText: {
    color: "#6B7280",
    fontSize: 13,
  },
  loggedBadge: {
    backgroundColor: "#F0FDF9",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 4,
    borderWidth: 0.5,
    borderColor: "#1D9E7550",
  },
  loggedBadgeText: {
    color: "#1D9E75",
    fontSize: 12,
    fontWeight: "500",
  },
  suggestions: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  suggestionsLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  suggestionChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 0.5,
    borderColor: "#E5E7EB",
  },
  chipText: {
    fontSize: 12,
    color: "#374151",
  },
  typingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typingText: {
    fontSize: 12,
    color: "#6B7280",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 28,
    backgroundColor: "#fff",
    borderTopWidth: 0.5,
    borderTopColor: "#E5E7EB",
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "#F8FAF9",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#1A1A1A",
    maxHeight: 100,
    borderWidth: 0.5,
    borderColor: "#E5E7EB",
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#1D9E75",
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "#D1D5DB",
  },
  sendBtnText: {
    color: "#fff",
    fontSize: 18,
  },
});
