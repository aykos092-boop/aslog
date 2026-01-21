import { useState } from "react";
import { Star, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface RatingFormProps {
  dealId: string;
  ratedUserId: string;
  ratedUserName: string;
  onRatingSubmitted: () => void;
}

export const RatingForm = ({ 
  dealId, 
  ratedUserId, 
  ratedUserName,
  onRatingSubmitted 
}: RatingFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [score, setScore] = useState(0);
  const [hoverScore, setHoverScore] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || score === 0) return;

    setSubmitting(true);

    const { error } = await supabase.from("ratings").insert({
      deal_id: dealId,
      rater_id: user.id,
      rated_id: ratedUserId,
      score,
      comment: comment.trim() || null,
    });

    setSubmitting(false);

    if (error) {
      console.error("Error submitting rating:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось отправить оценку",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Спасибо за отзыв!",
      description: "Ваша оценка успешно сохранена",
    });

    onRatingSubmitted();
  };

  const displayScore = hoverScore || score;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="w-5 h-5 text-gold" />
          Оцените сотрудничество
        </CardTitle>
        <CardDescription>
          Оставьте отзыв о {ratedUserName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Star Rating */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((starValue) => (
              <button
                key={starValue}
                type="button"
                className="p-1 transition-transform hover:scale-110 focus:outline-none"
                onMouseEnter={() => setHoverScore(starValue)}
                onMouseLeave={() => setHoverScore(0)}
                onClick={() => setScore(starValue)}
              >
                <Star
                  className={`w-8 h-8 transition-colors ${
                    starValue <= displayScore
                      ? "fill-gold text-gold"
                      : "text-muted-foreground"
                  }`}
                />
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {displayScore === 0 && "Выберите оценку"}
            {displayScore === 1 && "Очень плохо"}
            {displayScore === 2 && "Плохо"}
            {displayScore === 3 && "Нормально"}
            {displayScore === 4 && "Хорошо"}
            {displayScore === 5 && "Отлично!"}
          </p>
        </div>

        {/* Comment */}
        <Textarea
          placeholder="Напишите отзыв (необязательно)..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={500}
        />

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={score === 0 || submitting}
          className="w-full"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          Отправить отзыв
        </Button>
      </CardContent>
    </Card>
  );
};
