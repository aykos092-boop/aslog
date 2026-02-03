import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ru, enUS, uz } from "date-fns/locale";
import {
  ArrowLeft, User, Truck, Star, Shield,
  CheckCircle, Clock, TrendingUp, Award, Loader2, Quote, Pencil,
  Wallet, CreditCard, Plus, ArrowUpRight, ArrowDownRight, Globe, Calendar, Copy
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

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
  balance?: number;
  frozen_balance?: number;
  subscription_id?: string;
  subscription_expires_at?: string;
  trial_used?: boolean;
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

const EnhancedUserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useFirebaseAuth();
  const { t, language, setLanguage } = useLanguage();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [stats, setStats] = useState<Stats>({ totalDeals: 0, completedDeals: 0, activeDeals: 0, totalOrders: 0 });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [balance, setBalance] = useState(0);
  const [frozenBalance, setFrozenBalance] = useState(0);
  const [subscription, setSubscription] = useState<any>(null);
  const [showUserId, setShowUserId] = useState(false);
  
  const dateLocale = language === "ru" ? ru : language === "uz" ? uz : enUS;
  
  const getTrustLevel = (avgRating: number, completedDeals: number) => {
    if (completedDeals === 0) return { level: "new", label: t("level.beginner"), color: "bg-muted text-muted-foreground" };
    if (avgRating >= 4.5 && completedDeals >= 10) return { level: "gold", label: "Gold", color: "bg-gold text-white" };
    if (avgRating >= 4.0 && completedDeals >= 5) return { level: "silver", label: "Silver", color: "bg-gray-400 text-white" };
    if (avgRating >= 3.0 && completedDeals >= 1) return { level: "bronze", label: "Bronze", color: "bg-amber-600 text-white" };
    return { level: "new", label: t("level.beginner"), color: "bg-muted text-muted-foreground" };
  };

  const targetUserId = userId || user?.uid;

  const fetchProfile = async () => {
    if (!targetUserId) return;

    setLoading(true);

    try {
      // Fetch profile with balance
      const { data: profileData } = await supabase
        .from("profiles")
        .select(`
          *,
          subscriptions!inner(
            id,
            name,
            commission_percent,
            trial_days
          )
        `)
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData);
        setBalance(profileData.balance || 0);
        setFrozenBalance(profileData.frozen_balance || 0);
        
        // Set subscription data
        if (profileData.subscriptions) {
          setSubscription(profileData.subscriptions);
        }
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
      const { data: dealsData } = await supabase
        .from("deals")
        .select("status")
        .eq("carrier_id", targetUserId);

      const { data: ordersData } = await supabase
        .from("orders")
        .select("status")
        .eq("client_id", targetUserId);

      const allDeals = dealsData || [];
      const allOrders = ordersData || [];

      setStats({
        totalDeals: allDeals.length,
        completedDeals: allDeals.filter(d => d.status === "delivered").length,
        activeDeals: allDeals.filter(d => ["accepted", "in_transit"].includes(d.status)).length,
        totalOrders: allOrders.length,
      });

    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [targetUserId]);

  const handleEditComplete = () => {
    setIsEditing(false);
    fetchProfile();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Скопировано!",
      description: `${label} скопирован в буфер обмена`,
    });
  };

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

  const languages = [
    { code: "ru", name: "Русский", flag: "🇷🇺" },
    { code: "en", name: "English", flag: "🇬🇧" },
    { code: "uz", name: "O'zbekcha", flag: "🇺🇿" }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка профиля...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">{t("profile.notFound")}</h2>
          <Button onClick={() => navigate(-1)}>{t("common.back")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
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
            
            {/* Language Selector */}
            <div className="flex items-center gap-2">
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <span className="flex items-center gap-2">
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {isOwnProfile && !isEditing && (
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Pencil className="w-4 h-4 mr-2" />
                  {t("common.edit")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* User ID Card */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="font-medium text-blue-900">ID пользователя</h3>
                  <div className="flex items-center gap-2">
                    <code className="bg-blue-100 px-2 py-1 rounded text-sm font-mono text-blue-800">
                      {showUserId ? targetUserId : '••••••••••••••••'}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowUserId(!showUserId)}
                    >
                      {showUserId ? 'Скрыть' : 'Показать'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(targetUserId || '', 'ID пользователя')}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-blue-700 font-medium">Email:</span>
                  <div className="text-blue-600">{user?.email || 'Не указан'}</div>
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Дата регистрации:</span>
                  <div className="text-blue-600">
                    {format(new Date(profile.created_at), "dd MMMM yyyy, HH:mm", { locale: dateLocale })}
                  </div>
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Статус:</span>
                  <div className="flex items-center gap-2">
                    {profile.is_verified ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-green-600">Верифицирован</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4 text-yellow-500" />
                        <span className="text-yellow-600">Не верифицирован</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

        {/* Edit Form */}
        {isEditing && isOwnProfile ? (
          <ProfileEditForm
            profile={profile}
            isCarrier={role === "carrier"}
            onUpdate={handleEditComplete}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <>
            {/* Profile Card */}
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
                  <Truck className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                  <div className="text-2xl font-bold">{stats.totalOrders}</div>
                  <p className="text-sm text-muted-foreground">{t("profile.orders")}</p>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="ratings" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="ratings">{t("profile.ratings")}</TabsTrigger>
                <TabsTrigger value="history">{t("profile.history")}</TabsTrigger>
                <TabsTrigger value="verification">{t("profile.verification")}</TabsTrigger>
              </TabsList>

              <TabsContent value="ratings" className="space-y-4">
                {ratings.length > 0 ? (
                  ratings.map((rating) => (
                    <Card key={rating.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star
                                    key={s}
                                    className={`w-4 h-4 ${
                                      s <= rating.score ? "fill-gold text-gold" : "text-muted-foreground"
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className="font-medium">{rating.score}.0</span>
                            </div>
                            {rating.comment && (
                              <p className="text-sm text-muted-foreground mb-2">
                                <Quote className="w-4 h-4 inline mr-1" />
                                {rating.comment}
                              </p>
                            )}
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{rating.rater_profile?.full_name || t("profile.anonymous")}</span>
                              <span>{format(new Date(rating.created_at), "dd MMMM yyyy", { locale: dateLocale })}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <Star className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">{t("profile.noRatings")}</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="history" className="space-y-4">
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-medium mb-4">История активности</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <div>
                            <p className="font-medium">Регистрация на платформе</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(profile.created_at), "dd MMMM yyyy, HH:mm", { locale: dateLocale })}
                            </p>
                          </div>
                        </div>
                      </div>
                      {profile.is_verified && (
                        <div className="flex items-center justify-between p-3 border rounded">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <div>
                              <p className="font-medium">Пройдена верификация</p>
                              <p className="text-sm text-muted-foreground">Аккаунт подтвержден</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="verification" className="space-y-4">
                {isOwnProfile && (
                  <KYCVerificationForm
                    userId={targetUserId}
                    isVerified={profile.is_verified}
                    onVerificationComplete={fetchProfile}
                  />
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
};

export default EnhancedUserProfile;
