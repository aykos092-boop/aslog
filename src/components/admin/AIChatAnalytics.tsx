import { useState, useEffect } from "react";
import { Bot, MessageCircle, Star, Clock, TrendingUp, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface AIStats {
  totalQuestions: number;
  avgResponseTime: number;
  avgSatisfaction: number;
  satisfactionCounts: { [key: number]: number };
  popularQuestions: { question: string; count: number }[];
}

export const AIChatAnalytics = () => {
  const [stats, setStats] = useState<AIStats>({
    totalQuestions: 0,
    avgResponseTime: 0,
    avgSatisfaction: 0,
    satisfactionCounts: {},
    popularQuestions: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);

      const { data: logs } = await supabase
        .from("ai_chat_logs")
        .select("*")
        .order("created_at", { ascending: false });

      if (!logs || logs.length === 0) {
        setLoading(false);
        return;
      }

      // Calculate stats
      const totalQuestions = logs.length;
      
      const responseTimes = logs.filter(l => l.response_time_ms).map(l => l.response_time_ms!);
      const avgResponseTime = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;

      const ratings = logs.filter(l => l.satisfaction_rating).map(l => l.satisfaction_rating!);
      const avgSatisfaction = ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : 0;

      // Count satisfaction ratings
      const satisfactionCounts: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      ratings.forEach(r => {
        satisfactionCounts[r] = (satisfactionCounts[r] || 0) + 1;
      });

      // Find popular questions (simple word matching)
      const questionMap = new Map<string, number>();
      logs.forEach(log => {
        // Normalize question
        const normalized = log.question.toLowerCase().trim().slice(0, 50);
        questionMap.set(normalized, (questionMap.get(normalized) || 0) + 1);
      });

      const popularQuestions = Array.from(questionMap.entries())
        .map(([question, count]) => ({ question, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setStats({
        totalQuestions,
        avgResponseTime,
        avgSatisfaction,
        satisfactionCounts,
        popularQuestions,
      });
      setLoading(false);
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalRatings = Object.values(stats.satisfactionCounts).reduce((a, b) => a + b, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          Аналитика AI-чата
        </CardTitle>
        <CardDescription>
          Статистика использования AI-помощника
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <MessageCircle className="w-6 h-6 mx-auto text-primary mb-2" />
            <div className="text-2xl font-bold">{stats.totalQuestions}</div>
            <div className="text-xs text-muted-foreground">Всего вопросов</div>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <Clock className="w-6 h-6 mx-auto text-blue-500 mb-2" />
            <div className="text-2xl font-bold">{(stats.avgResponseTime / 1000).toFixed(1)}с</div>
            <div className="text-xs text-muted-foreground">Среднее время ответа</div>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <Star className="w-6 h-6 mx-auto text-yellow-500 mb-2" />
            <div className="text-2xl font-bold">
              {stats.avgSatisfaction > 0 ? stats.avgSatisfaction.toFixed(1) : "—"}
            </div>
            <div className="text-xs text-muted-foreground">Средняя оценка</div>
          </div>
        </div>

        {/* Satisfaction distribution */}
        {totalRatings > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Распределение оценок
            </h4>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = stats.satisfactionCounts[rating] || 0;
                const percent = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
                
                return (
                  <div key={rating} className="flex items-center gap-3">
                    <div className="flex items-center gap-1 w-12">
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      <span className="text-sm">{rating}</span>
                    </div>
                    <Progress value={percent} className="flex-1 h-2" />
                    <span className="text-sm text-muted-foreground w-12 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Popular questions */}
        {stats.popularQuestions.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Популярные вопросы
            </h4>
            <div className="space-y-2">
              {stats.popularQuestions.map((q, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 bg-muted/30 rounded-lg"
                >
                  <span className="text-sm truncate flex-1">
                    {q.question}
                  </span>
                  <Badge variant="secondary" className="ml-2">
                    {q.count}×
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.totalQuestions === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Пока нет данных для отображения
          </div>
        )}
      </CardContent>
    </Card>
  );
};
