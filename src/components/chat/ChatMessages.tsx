import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Send, Loader2, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  is_system: boolean;
  created_at: string;
  sender_profile?: {
    full_name: string | null;
  };
}

interface ChatMessagesProps {
  contextType: "order" | "deal";
  contextId: string;
  participantIds: string[];
}

export const ChatMessages = ({ contextType, contextId, participantIds }: ChatMessagesProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch initial messages
  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);

      const query = supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });

      if (contextType === "order") {
        query.eq("order_id", contextId);
      } else {
        query.eq("deal_id", contextId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching messages:", error);
        setLoading(false);
        return;
      }

      // Fetch sender profiles
      const senderIds = [...new Set(data?.map(m => m.sender_id) || [])];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", senderIds);

      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);

      const messagesWithProfiles = (data || []).map(msg => ({
        ...msg,
        sender_profile: profilesMap.get(msg.sender_id),
      }));

      setMessages(messagesWithProfiles);
      setLoading(false);
    };

    fetchMessages();
  }, [contextId, contextType]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${contextType}-${contextId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: contextType === "order" 
            ? `order_id=eq.${contextId}`
            : `deal_id=eq.${contextId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          
          // Fetch sender profile
          const { data: profileData } = await supabase
            .from("profiles")
            .select("user_id, full_name")
            .eq("user_id", newMsg.sender_id)
            .single();

          const msgWithProfile = {
            ...newMsg,
            sender_profile: profileData,
          };

          setMessages((prev) => [...prev, msgWithProfile]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contextId, contextType]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !newMessage.trim()) return;

    setSending(true);

    const insertData = {
      sender_id: user.id,
      content: newMessage.trim(),
      is_system: false,
      order_id: contextType === "order" ? contextId : null,
      deal_id: contextType === "deal" ? contextId : null,
    };

    const { error } = await supabase.from("messages").insert(insertData);

    setSending(false);

    if (error) {
      console.error("Error sending message:", error);
    } else {
      setNewMessage("");
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Сообщений пока нет</p>
              <p className="text-sm">Начните диалог первым!</p>
            </div>
          )}

          {messages.map((message) => {
            const isOwn = message.sender_id === user?.id;
            const isSystem = message.is_system;

            if (isSystem) {
              return (
                <div key={message.id} className="flex justify-center">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-muted-foreground text-sm">
                    <Bot className="w-4 h-4" />
                    {message.content}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={message.id}
                className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}
              >
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarFallback className={isOwn ? "gradient-customer" : "gradient-driver"}>
                    {message.sender_profile?.full_name?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`max-w-[70%] ${
                    isOwn ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`rounded-2xl px-4 py-2 ${
                      isOwn
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-muted rounded-tl-sm"
                    }`}
                  >
                    {!isOwn && message.sender_profile?.full_name && (
                      <p className="text-xs font-medium mb-1 opacity-70">
                        {message.sender_profile.full_name}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                  <p className={`text-xs text-muted-foreground mt-1 ${isOwn ? "text-right" : ""}`}>
                    {format(new Date(message.created_at), "HH:mm", { locale: ru })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Message Input */}
      <form
        onSubmit={handleSendMessage}
        className="p-4 border-t bg-card flex gap-2"
      >
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Написать сообщение..."
          disabled={sending}
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={!newMessage.trim() || sending}
          size="icon"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </form>
    </div>
  );
};
