import { useState, useRef, useEffect, useCallback } from "react";
import { COLORS } from "../constants";
import { Card, Button, Spinner } from "../components";
import { useAuth } from "../contexts/AuthContext";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

type MessageRole = "user" | "assistant" | "system";

interface FoodCard {
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  serving: string;
  reason: string;
}

interface LogMeal {
  food_name: string;
  quantity: number;
  weight_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
}

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  foodCard?: FoodCard;
  logMeal?: LogMeal;
  isStreaming?: boolean;
  logConfirmed?: boolean;
}

const QUICK_SUGGESTIONS = [
  "What should I eat for lunch?",
  "I had 2 idlis for breakfast",
  "What's my protein deficit today?",
  "Suggest a high-protein dinner",
  "Am I on track today?",
  "Give me a Tamil Nadu dinner idea",
];

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

export default function CopilotCoach() {
  const { token } = useAuth();
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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    
    setShowSuggestions(false);
    setInput("");
    setIsLoading(true);
    
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    
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
      const history = messages
        .filter(m => m.id !== "welcome" && !m.isStreaming)
        .slice(-10)
        .map(m => ({
          role: m.role,
          content: m.content,
        }));
      
      const response = await fetch(`${API_BASE}/api/copilot/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text.trim(),
          conversation_history: history,
        }),
      });
      
      if (!response.ok) {
        throw new Error();
      }
      
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        let lineIndex = buffer.indexOf("\n");
        
        while (lineIndex !== -1) {
          const line = buffer.slice(0, lineIndex).trim();
          buffer = buffer.slice(lineIndex + 1);
          
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.done) {
                break;
              }
              if (data.text) {
                fullText += data.text;
                setMessages(prev => prev.map(m =>
                  m.id === assistantMsgId
                    ? { ...m, content: fullText }
                    : m
                ));
              }
            } catch {}
          }
          lineIndex = buffer.indexOf("\n");
        }
      }
      
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
      
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId ? {
          ...m,
          content: "Sorry, I couldn't connect to the AI copilot service. Please try again.",
          isStreaming: false,
        } : m
      ));
    } finally {
      setIsLoading(false);
    }
  }, [messages, token, isLoading]);
  
  const logMeal = useCallback(async (meal: LogMeal) => {
    try {
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
      
      const confirmMsg: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `✓ ${meal.food_name} logged! ${meal.calories} kcal, ${meal.protein_g}g protein, ${meal.carbs_g}g carbs, and ${meal.fats_g}g fats added.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, confirmMsg]);
      
    } catch {
      const errMsg: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: "Failed to log this meal. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    }
  }, [token]);
  
  const confirmLog = useCallback((msgId: string) => {
    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, logConfirmed: true } : m
    ));
  }, []);
  
  return (
    <Card style={{ padding: 24, display: "flex", flexDirection: "column", height: "calc(100vh - 200px)", minHeight: 500, background: COLORS.surface, borderColor: COLORS.border, borderRadius: 16 }}>
      
      {/* Messages list */}
      <div style={{ flex: 1, overflowY: "auto", paddingRight: 8, display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
        {messages.map(m => {
          const isUser = m.role === "user";
          return (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", maxWidth: "80%", alignSelf: isUser ? "flex-end" : "flex-start" }}>
              {m.content.trim() !== "" && (
                <div style={{
                  padding: "12px 18px", borderRadius: 16, fontSize: 14.5, lineHeight: 1.5,
                  background: isUser ? `linear-gradient(135deg, ${COLORS.emerald}, ${COLORS.teal})` : COLORS.card,
                  color: isUser ? "#fff" : COLORS.text,
                  border: isUser ? "none" : `1px solid ${COLORS.border}`,
                  borderBottomRightRadius: isUser ? 4 : 16,
                  borderBottomLeftRadius: isUser ? 16 : 4,
                  whiteSpace: "pre-line"
                }}>
                  {m.content}
                  {m.isStreaming && (
                    <span style={{ color: COLORS.emerald, fontWeight: "bold", marginLeft: 4, animation: "blink 0.8s infinite" }}>▋</span>
                  )}
                </div>
              )}
              
              {/* Food Recommendation Card */}
              {m.foodCard && (
                <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16, marginTop: 10, width: "100%", maxWidth: 380 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontWeight: 700, color: COLORS.text }}>{m.foodCard.food_name}</span>
                    <span style={{ fontSize: 12, color: COLORS.muted }}>{m.foodCard.serving}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 6, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 8, marginBottom: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{m.foodCard.calories}</span>
                      <span style={{ fontSize: 10, color: COLORS.muted }}>kcal</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.protein }}>{m.foodCard.protein_g}g</span>
                      <span style={{ fontSize: 10, color: COLORS.muted }}>protein</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.carbs }}>{m.foodCard.carbs_g}g</span>
                      <span style={{ fontSize: 10, color: COLORS.muted }}>carbs</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.fat }}>{m.foodCard.fats_g}g</span>
                      <span style={{ fontSize: 10, color: COLORS.muted }}>fats</span>
                    </div>
                  </div>
                  {m.foodCard.reason && (
                    <p style={{ fontSize: 12, color: COLORS.muted, fontStyle: "italic", marginBottom: 12 }}>{m.foodCard.reason}</p>
                  )}
                  <Button style={{ width: "100%", padding: "8px 0" }} onClick={() => {
                    const meal: LogMeal = {
                      food_name: m.foodCard!.food_name,
                      quantity: 1,
                      weight_g: 100,
                      calories: m.foodCard!.calories,
                      protein_g: m.foodCard!.protein_g,
                      carbs_g: m.foodCard!.carbs_g,
                      fats_g: m.foodCard!.fats_g,
                    };
                    logMeal(meal);
                  }}>+ Log this meal</Button>
                </div>
              )}
              
              {/* Log meal confirmation */}
              {m.logMeal && !m.logConfirmed && (
                <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, marginTop: 10, width: "100%", maxWidth: 360 }}>
                  <h4 style={{ fontSize: 14, color: COLORS.text, fontWeight: 600, marginBottom: 4 }}>Log this meal?</h4>
                  <p style={{ fontSize: 12, color: COLORS.muted, marginBottom: 14 }}>
                    {m.logMeal.food_name} · {m.logMeal.calories} kcal · {m.logMeal.protein_g}g protein
                  </p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <Button style={{ flex: 1, padding: "8px 0" }} onClick={() => {
                      logMeal(m.logMeal!);
                      confirmLog(m.id);
                    }}>Yes, log it</Button>
                    <button style={{ flex: 1, border: `1px solid ${COLORS.border}`, borderRadius: 8, background: "transparent", color: COLORS.muted, cursor: "pointer", fontSize: 13 }} onClick={() => confirmLog(m.id)}>
                      No thanks
                    </button>
                  </div>
                </div>
              )}
              
              {m.logConfirmed && m.logMeal && (
                <div style={{ fontSize: 12, color: COLORS.emerald, background: `${COLORS.emerald}12`, border: `1px solid ${COLORS.emerald}24`, borderRadius: 8, padding: "6px 12px", marginTop: 8 }}>
                  ✓ {m.logMeal.food_name} logged successfully
                </div>
              )}
              
              <span style={{ fontSize: 10, color: COLORS.muted, marginTop: 4, alignSelf: isUser ? "flex-end" : "flex-start" }}>
                {m.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Suggestions */}
      {showSuggestions && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Try asking:</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {QUICK_SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={() => sendMessage(s)} style={{
                background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 20,
                padding: "6px 14px", color: COLORS.text, cursor: "pointer", fontSize: 12, fontFamily: "inherit",
                transition: "all 0.2s"
              }} onMouseOver={e => (e.currentTarget.style.borderColor = COLORS.emerald)} onMouseOut={e => (e.currentTarget.style.borderColor = COLORS.border)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Loading indicator */}
      {isLoading && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Spinner size="sm" />
          <span style={{ fontSize: 12, color: COLORS.muted }}>AI Copilot is thinking...</span>
        </div>
      )}
      
      {/* Input bar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input type="text" value={input} onChange={e => setInput(e.target.value)}
          placeholder="Ask about nutrition, request recommendations or log meals..."
          onFocus={() => setShowSuggestions(false)}
          onKeyDown={e => { if (e.key === "Enter") sendMessage(input); }}
          style={{
            flex: 1, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12,
            padding: "12px 18px", fontSize: 14, outline: "none", transition: "all 0.2s"
          }} />
        <Button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading} style={{ height: 42, padding: "0 20px" }}>
          Send ➤
        </Button>
      </div>
      
      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
      
    </Card>
  );
}
