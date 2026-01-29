import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";

type Message = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

export const useAIChat = () => {
  const { user } = useFirebaseAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [lastLogId, setLastLogId] = useState<string | null>(null);
  const startTimeRef = useRef<number>(0);

  // Load conversation history on mount
  useEffect(() => {
    const loadHistory = async () => {
      if (!user || historyLoaded) return;

      try {
        const { data, error } = await supabase
          .from("ai_conversations")
          .select("*")
          .eq("user_id", user.uid)
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();

        if (error) {
          // It's okay if user doesn't have conversations yet
          if (error.code !== 'PGRST116') {
            console.error("Error loading conversation history:", error);
          }
          setHistoryLoaded(true);
          return;
        }

        if (data) {
          setConversationId(data.id);
          const savedMessages = data.messages as Message[];
          if (Array.isArray(savedMessages) && savedMessages.length > 0) {
            setMessages(savedMessages);
          }
        }
      } catch (error) {
        console.error("Error in loadHistory:", error);
      }
      setHistoryLoaded(true);
    };

    loadHistory();
  }, [user, historyLoaded]);

  // Save messages to database
  const saveMessages = useCallback(async (newMessages: Message[]) => {
    if (!user) return;

    if (conversationId) {
      await supabase
        .from("ai_conversations")
        .update({ messages: newMessages as any, updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    } else {
      const { data } = await supabase
        .from("ai_conversations")
        .insert({ user_id: user.uid, messages: newMessages as any })
        .select()
        .single();
      
      if (data) {
        setConversationId(data.id);
      }
    }
  }, [user, conversationId]);

  // Log chat for analytics
  const logChat = useCallback(async (question: string, responseTimeMs: number) => {
    if (!user) return null;

    const { data } = await supabase
      .from("ai_chat_logs")
      .insert({
        user_id: user.uid,
        question,
        response_time_ms: responseTimeMs,
      })
      .select()
      .single();

    return data?.id || null;
  }, [user]);

  // Rate response
  const rateResponse = useCallback(async (rating: number) => {
    if (!lastLogId) return;

    await supabase
      .from("ai_chat_logs")
      .update({ satisfaction_rating: rating })
      .eq("id", lastLogId);

    setLastLogId(null);
  }, [lastLogId]);

  const sendMessage = useCallback(async (input: string) => {
    // Require authentication before sending messages
    if (!user) {
      console.error("No user available");
      setMessages((prev) => [
        ...prev,
        { role: "user", content: input },
        { role: "assistant", content: "Пожалуйста, войдите в систему для использования AI-ассистента." }
      ]);
      return;
    }

    const userMsg: Message = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);
    startTimeRef.current = Date.now();

    let assistantSoFar = "";

    const upsertAssistant = (nextChunk: string) => {
      assistantSoFar += nextChunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
          );
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      // Get Firebase ID token for authentication
      const idToken = await user.getIdToken();
      
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 401) {
          throw new Error("Сессия истекла. Пожалуйста, войдите снова.");
        }
        throw new Error("Failed to start stream");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            /* ignore */
          }
        }
      }

      // Log analytics
      const responseTime = Date.now() - startTimeRef.current;
      const logId = await logChat(input, responseTime);
      setLastLogId(logId);

      // Save final conversation
      setMessages((prev) => {
        saveMessages(prev);
        return prev;
      });
    } catch (error) {
      console.error("AI chat error:", error);
      const errorMessage = error instanceof Error ? error.message : "Произошла ошибка. Попробуйте ещё раз.";
      const errorMessages = [...newMessages, { role: "assistant" as const, content: errorMessage }];
      setMessages(errorMessages);
      saveMessages(errorMessages);
    } finally {
      setIsLoading(false);
    }
  }, [messages, saveMessages, logChat, user]);

  const clearMessages = useCallback(async () => {
    setMessages([]);
    setLastLogId(null);
    if (conversationId) {
      await supabase
        .from("ai_conversations")
        .delete()
        .eq("id", conversationId);
      setConversationId(null);
    }
  }, [conversationId]);

  return { 
    messages, 
    isLoading, 
    sendMessage, 
    clearMessages, 
    historyLoaded,
    canRate: !!lastLogId,
    rateResponse,
  };
};
