import { Star, Quote } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Rating {
  id: string;
  score: number;
  comment: string | null;
  created_at: string;
  rater_profile?: {
    full_name: string | null;
  };
}

interface RatingDisplayProps {
  rating: Rating;
  title?: string;
}

export const RatingDisplay = ({ rating, title }: RatingDisplayProps) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="w-5 h-5 text-gold fill-gold" />
          {title || "Ваш отзыв"}
        </CardTitle>
        <CardDescription>
          Отправлено {format(new Date(rating.created_at), "d MMMM yyyy", { locale: ru })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-3">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((starValue) => (
              <Star
                key={starValue}
                className={`w-5 h-5 ${
                  starValue <= rating.score
                    ? "fill-gold text-gold"
                    : "text-muted-foreground"
                }`}
              />
            ))}
          </div>
          <span className="font-medium">{rating.score}/5</span>
        </div>

        {rating.comment && (
          <div className="flex gap-2 text-sm text-muted-foreground">
            <Quote className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="italic">{rating.comment}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface RatingsListProps {
  ratings: Rating[];
  emptyMessage?: string;
}

export const RatingsList = ({ ratings, emptyMessage }: RatingsListProps) => {
  if (ratings.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Star className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>{emptyMessage || "Пока нет отзывов"}</p>
      </div>
    );
  }

  const averageScore = ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
        <div className="text-center">
          <div className="text-3xl font-bold">{averageScore.toFixed(1)}</div>
          <div className="flex gap-0.5 justify-center">
            {[1, 2, 3, 4, 5].map((starValue) => (
              <Star
                key={starValue}
                className={`w-4 h-4 ${
                  starValue <= Math.round(averageScore)
                    ? "fill-gold text-gold"
                    : "text-muted-foreground"
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {ratings.length} {ratings.length === 1 ? "отзыв" : "отзывов"}
          </p>
        </div>

        {/* Distribution */}
        <div className="flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map((score) => {
            const count = ratings.filter(r => r.score === score).length;
            const percentage = (count / ratings.length) * 100;
            return (
              <div key={score} className="flex items-center gap-2 text-xs">
                <span className="w-3">{score}</span>
                <Star className="w-3 h-3 text-gold fill-gold" />
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gold rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="w-6 text-muted-foreground">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Individual ratings */}
      <div className="space-y-3">
        {ratings.map((rating) => (
          <div key={rating.id} className="p-3 rounded-lg border bg-card">
            <div className="flex items-start gap-3">
              <Avatar className="w-8 h-8">
                <AvatarFallback>
                  {rating.rater_profile?.full_name?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">
                    {rating.rater_profile?.full_name || "Пользователь"}
                  </span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((starValue) => (
                      <Star
                        key={starValue}
                        className={`w-3 h-3 ${
                          starValue <= rating.score
                            ? "fill-gold text-gold"
                            : "text-muted-foreground"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {format(new Date(rating.created_at), "d MMM yyyy", { locale: ru })}
                  </span>
                </div>
                {rating.comment && (
                  <p className="text-sm text-muted-foreground">{rating.comment}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
