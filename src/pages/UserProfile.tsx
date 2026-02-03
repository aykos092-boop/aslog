import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import {
  ArrowLeft, User, Truck, Star, Shield,
  CheckCircle, Clock, TrendingUp, Award, Loader2, Quote, Pencil,
  Wallet, CreditCard, Plus, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileEditForm } from "@/components/profile/ProfileEditForm";
import { KYCVerificationForm } from "@/components/kyc/KYCVerificationForm";

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  company_name: string | null;
  carrier_type: string | null;
  vehicle_type: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  created_at: string;
}

interface Rating {
  id: string;
  score: number;
  comment: string | null;
  created_at: string;
  rater_profile?: {
    full_name: string | null;
  };
}

interface Stats {
  totalDeals: number;
  completedDeals: number;
  activeDeals: number;
  totalOrders: number;
}

type UserRole = "client" | "carrier" | "admin";

const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useFirebaseAuth();
  const { t, language } = useLanguage();
  
  const dateLocale = language === "ru" ? ru : language === "uz" ? ru : enUS;
  
  const getTrustLevel = (avgRating: number, completedDeals: number) => {
    if (completedDeals === 0) return { level: "new", label: t("level.beginner"), color: "bg-muted text-muted-foreground" };
    if (avgRating >= 4.5 && completedDeals >= 10) return { level: "gold", label: "Gold", color: "bg-gold text-white" };
    if (avgRating >= 4.0 && completedDeals >= 5) return { level: "silver", label: "Silver", color: "bg-gray-400 text-white" };
    if (avgRating >= 3.0 && completedDeals >= 1) return { level: "bronze", label: "Bronze", color: "bg-amber-600 text-white" };
    return { level: "new", label: t("level.beginner"), color: "bg-muted text-muted-foreground" };
  };

  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [stats, setStats] = useState<Stats>({ totalDeals: 0, completedDeals: 0, activeDeals: 0, totalOrders: 0 });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [balance, setBalance] = useState(0);
  const [frozenBalance, setFrozenBalance] = useState(0);
  const [subscription, setSubscription] = useState<any>(null);

  const targetUserId = userId || user?.uid;

  const fetchProfile = async () => {
    if (!targetUserId) return;

    setLoading(true);

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData);
        // Set balance and frozen balance from profile
        setBalance(profileData.balance || 0);
        setFrozenBalance(profileData.frozen_balance || 0);
      }

      // Fetch role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (roleData) {
        setRole(roleData.role as UserRole);
      }

      // Fetch ratings
      const { data: ratingsData } = await supabase
        .from("ratings")
        .select("*")
        .eq("rated_id", targetUserId)
        .order("created_at", { ascending: false });

      if (ratingsData) {
        // Fetch rater profiles
        const raterIds = [...new Set(ratingsData.map(r => r.rater_id))];
        const { data: raterProfiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", raterIds);

        const profilesMap = new Map(raterProfiles?.map(p => [p.user_id, p]) || []);

        const ratingsWithProfiles = ratingsData.map(r => ({
          ...r,
          rater_profile: profilesMap.get(r.rater_id),
        }));

        setRatings(ratingsWithProfiles);
      }

      // Fetch stats
      const isCarrier = roleData?.role === "carrier";

      if (isCarrier) {
        const [totalRes, completedRes, activeRes] = await Promise.all([
          supabase.from("deals").select("id", { count: "exact", head: true }).eq("carrier_id", targetUserId),
          supabase.from("deals").select("id", { count: "exact", head: true }).eq("carrier_id", targetUserId).eq("status", "delivered"),
          supabase.from("deals").select("id", { count: "exact", head: true }).eq("carrier_id", targetUserId).in("status", ["pending", "accepted", "in_transit"]),
        ]);

        setStats({
          totalDeals: totalRes.count || 0,
          completedDeals: completedRes.count || 0,
          activeDeals: activeRes.count || 0,
          totalOrders: 0,
        });
      } else {
        const [totalRes, completedRes, activeRes, ordersRes] = await Promise.all([
          supabase.from("deals").select("id", { count: "exact", head: true }).eq("client_id", targetUserId),
          supabase.from("deals").select("id", { count: "exact", head: true }).eq("client_id", targetUserId).eq("status", "delivered"),
          supabase.from("deals").select("id", { count: "exact", head: true }).eq("client_id", targetUserId).in("status", ["pending", "accepted", "in_transit"]),
          supabase.from("orders").select("id", { count: "exact", head: true }).eq("client_id", targetUserId),
        ]);

        setStats({
          totalDeals: totalRes.count || 0,
          completedDeals: completedRes.count || 0,
          activeDeals: activeRes.count || 0,
          totalOrders: ordersRes.count || 0,
        });
      }

    setLoading(false);
  };

  useEffect(() => {
    fetchProfile();
  }, [targetUserId]);

  const handleEditComplete = () => {
    setIsEditing(false);
    fetchProfile();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <User className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">{t("profile.notFound")}</h2>
          <Button onClick={() => navigate(-1)}>{t("common.back")}</Button>
        </div>
      </div>
    );
  }

  const avgRating = ratings.length > 0
    ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
    : 0;

  const trustLevel = getTrustLevel(avgRating, stats.completedDeals);
  const isOwnProfile = user?.uid === targetUserId;

  const roleConfig = {
    client: { label: t("role.client"), icon: User, color: "bg-customer text-white" },
    carrier: { label: t("role.carrier"), icon: Truck, color: "bg-driver text-white" },
    admin: { label: t("role.admin"), icon: Shield, color: "bg-primary text-primary-foreground" },
  };

  const currentRole = role ? roleConfig[role] : null;
  const RoleIcon = currentRole?.icon || User;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-xl font-bold">
                {isOwnProfile ? t("profile.myProfile") : t("profile.userProfile")}
              </h1>
            </div>
            {isOwnProfile && !isEditing && (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Pencil className="w-4 h-4 mr-2" />
                {t("common.edit")}
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Edit Form */}
        {isEditing && isOwnProfile ? (
          <ProfileEditForm
            profile={profile}
            isCarrier={role === "carrier"}
            onUpdate={handleEditComplete}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          /* Profile Card */
          <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Avatar */}
              <Avatar className="w-24 h-24">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className={`text-2xl ${currentRole?.color || "bg-muted"}`}>
                  {profile.full_name?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>

              {/* Info */}
              <div className="flex-1 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
                  <h2 className="text-2xl font-bold">{profile.full_name || t("profile.noName")}</h2>
                  {profile.is_verified && (
                    <Badge variant="outline" className="text-green-500 border-green-500">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {t("profile.verified")}
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-4">
                  {currentRole && (
                    <Badge className={currentRole.color}>
                      <RoleIcon className="w-3 h-3 mr-1" />
                      {currentRole.label}
                    </Badge>
                  )}
                  <Badge className={trustLevel.color}>
                    <Award className="w-3 h-3 mr-1" />
                    {trustLevel.label}
                  </Badge>
                </div>

                {/* Rating Summary */}
                <div className="flex items-center justify-center sm:justify-start gap-4">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-5 h-5 ${
                            s <= Math.round(avgRating) ? "fill-gold text-gold" : "text-muted-foreground"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="font-bold text-lg">{avgRating.toFixed(1)}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {ratings.length} {ratings.length === 1 ? t("profile.review") : t("profile.reviewsCount")}
                  </span>
                </div>

                {/* Additional Info */}
                {(profile.company_name || profile.vehicle_type) && (
                  <div className="mt-4 text-sm text-muted-foreground">
                    {profile.company_name && <p>{t("profile.company")}: {profile.company_name}</p>}
                    {profile.vehicle_type && <p>{t("profile.vehicle")}: {profile.vehicle_type}</p>}
                  </div>
                )}

                <p className="text-xs text-muted-foreground mt-2">
                  {t("profile.onPlatformSince")} {format(new Date(profile.created_at), "MMMM yyyy", { locale: dateLocale })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Balance Cards - NEW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <Wallet className="w-8 h-8 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-bold">{(balance / 1000000).toFixed(2)}M UZS</div>
              <p className="text-sm text-muted-foreground">Баланс</p>
              {isOwnProfile && (
                <div className="mt-2 space-x-2">
                  <Button size="sm" variant="outline" onClick={() => navigate('/wallet/deposit')}>
                    <Plus className="w-3 h-3 mr-1" />
                    Пополнить
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate('/wallet/withdraw')}>
                    <ArrowUpRight className="w-3 h-3 mr-1" />
                    Вывести
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <CreditCard className="w-8 h-8 mx-auto mb-2 text-orange-500" />
              <div className="text-2xl font-bold">{(frozenBalance / 1000000).toFixed(2)}M UZS</div>
              <p className="text-sm text-muted-foreground">Заморожено</p>
              <p className="text-xs text-muted-foreground">В сделках</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Shield className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <div className="text-2xl font-bold">
                {subscription ? subscription.name : 'Нет подписки'}
              </div>
              <p className="text-sm text-muted-foreground">Подписка</p>
              {isOwnProfile && !subscription && (
                <Button size="sm" variant="outline" onClick={() => navigate('/subscriptions')} className="mt-2">
                  <Plus className="w-3 h-3 mr-1" />
                  Оформить
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-bold">{stats.totalDeals}</div>
              <p className="text-sm text-muted-foreground">{t("profile.totalDeals")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <div className="text-2xl font-bold">{stats.completedDeals}</div>
              <p className="text-sm text-muted-foreground">{t("profile.completed")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Clock className="w-8 h-8 mx-auto mb-2 text-driver" />
              <div className="text-2xl font-bold">{stats.activeDeals}</div>
              <p className="text-sm text-muted-foreground">{t("profile.active")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Star className="w-8 h-8 mx-auto mb-2 text-gold" />
              <div className="text-2xl font-bold">{avgRating.toFixed(1)}</div>
              <p className="text-sm text-muted-foreground">{t("profile.rating")}</p>
            </CardContent>
          </Card>
        </div>

        {/* Rating Distribution */}
        {ratings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5 text-gold" />
                {t("profile.ratingDistribution")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map((score) => {
                  const count = ratings.filter(r => r.score === score).length;
                  const percentage = (count / ratings.length) * 100;
                  return (
                    <div key={score} className="flex items-center gap-3">
                      <div className="flex items-center gap-1 w-12">
                        <span className="font-medium">{score}</span>
                        <Star className="w-4 h-4 fill-gold text-gold" />
                      </div>
                      <Progress value={percentage} className="flex-1 h-3" />
                      <span className="w-12 text-sm text-muted-foreground text-right">
                        {count} ({Math.round(percentage)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* KYC Section - Only for own profile */}
        {isOwnProfile && (
          <Tabs defaultValue="reviews" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="reviews">{t("profile.reviews")}</TabsTrigger>
              <TabsTrigger value="kyc">{t("profile.verification")}</TabsTrigger>
            </TabsList>

            <TabsContent value="reviews">
              {/* Reviews */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Quote className="w-5 h-5" />
                    {t("profile.reviews")}
                  </CardTitle>
                  <CardDescription>
                    {ratings.length > 0 ? `${ratings.length} ${t("profile.reviewsCount")}` : t("profile.noReviewsYet")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {ratings.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Star className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p>{t("profile.noReviewsYet")}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {ratings.map((rating) => (
                        <div key={rating.id} className="p-4 rounded-lg border bg-card">
                          <div className="flex items-start gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarFallback>
                                {rating.rater_profile?.full_name?.charAt(0) || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium">
                                  {rating.rater_profile?.full_name || t("profile.user")}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(rating.created_at), "d MMMM yyyy", { locale: dateLocale })}
                                </span>
                              </div>
                              <div className="flex gap-0.5 mb-2">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star
                                    key={s}
                                    className={`w-4 h-4 ${
                                      s <= rating.score ? "fill-gold text-gold" : "text-muted-foreground"
                                    }`}
                                  />
                                ))}
                              </div>
                              {rating.comment && (
                                <p className="text-sm text-muted-foreground">{rating.comment}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="kyc">
              <KYCVerificationForm />
            </TabsContent>
          </Tabs>
        )}

        {/* Reviews for other profiles */}
        {!isOwnProfile && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Quote className="w-5 h-5" />
                Отзывы
              </CardTitle>
              <CardDescription>
                {ratings.length > 0 ? `${ratings.length} отзывов` : "Пока нет отзывов"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ratings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Star className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>У пользователя пока нет отзывов</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {ratings.map((rating) => (
                    <div key={rating.id} className="p-4 rounded-lg border bg-card">
                      <div className="flex items-start gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback>
                            {rating.rater_profile?.full_name?.charAt(0) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">
                              {rating.rater_profile?.full_name || "Пользователь"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(rating.created_at), "d MMMM yyyy", { locale: ru })}
                            </span>
                          </div>
                          <div className="flex gap-0.5 mb-2">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-4 h-4 ${
                                  s <= rating.score ? "fill-gold text-gold" : "text-muted-foreground"
                                }`}
                              />
                            ))}
                          </div>
                          {rating.comment && (
                            <p className="text-sm text-muted-foreground">{rating.comment}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default UserProfile;
