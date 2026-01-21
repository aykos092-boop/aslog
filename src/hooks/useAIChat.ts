import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Message = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

export const useAIChat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Load conversation history on mount
  useEffect(() => {
    const loadHistory = async () => {
      if (!user || historyLoaded) return;

      const { data } = await supabase
        .from("ai_conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setConversationId(data.id);
        const savedMessages = data.messages as Message[];
        if (Array.isArray(savedMessages) && savedMessages.length > 0) {
          setMessages(savedMessages);
        }
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
        .insert({ user_id: user.id, messages: newMessages as any })
        .select()
        .single();
      
      if (data) {
        setConversationId(data.id);
      }
    }
  }, [user, conversationId]);

  const sendMessage = useCallback(async (input: string) => {
    const userMsg: Message = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

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
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!resp.ok || !resp.body) {
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

      // Save final conversation
      setMessages((prev) => {
        saveMessages(prev);
        return prev;
      });
    } catch (error) {
      console.error("AI chat error:", error);
      const errorMessages = [...newMessages, { role: "assistant" as const, content: "Произошла ошибка. Попробуйте ещё раз." }];
      setMessages(errorMessages);
      saveMessages(errorMessages);
    } finally {
      setIsLoading(false);
    }
  }, [messages, saveMessages]);

  const clearMessages = useCallback(async () => {
    setMessages([]);
    if (conversationId) {
      await supabase
        .from("ai_conversations")
        .delete()
        .eq("id", conversationId);
      setConversationId(null);
    }
  }, [conversationId]);

  return { messages, isLoading, sendMessage, clearMessages, historyLoaded };
};
