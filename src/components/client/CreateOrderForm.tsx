import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { CalendarIcon, Package, MapPin, Loader2, Tag, Check, X, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CargoImageUpload } from "./CargoImageUpload";

// Central Asia regions and cities
const centralAsiaData = {
  uzbekistan: {
    nameKey: "region.uzbekistan",
    cities: [
      "Toshkent", "Samarqand", "Buxoro", "Andijon", "Namangan", 
      "Farg'ona", "Qarshi", "Nukus", "Urganch", "Jizzax",
      "Termiz", "Navoiy", "Guliston", "Chirchiq", "Olmaliq"
    ]
  },
  kazakhstan: {
    nameKey: "region.kazakhstan",
    cities: [
      "Almaty", "Nur-Sultan", "Shymkent", "Aktobe", "Karaganda",
      "Taraz", "Pavlodar", "Ust-Kamenogorsk", "Semey", "Atyrau",
      "Kostanay", "Kyzylorda", "Aktau", "Turkestan", "Petropavlovsk"
    ]
  },
  kyrgyzstan: {
    nameKey: "region.kyrgyzstan",
    cities: [
      "Bishkek", "Osh", "Jalal-Abad", "Karakol", "Tokmok",
      "Naryn", "Batken", "Talas", "Isfana", "Kara-Balta"
    ]
  },
  tajikistan: {
    nameKey: "region.tajikistan",
    cities: [
      "Dushanbe", "Khujand", "Kulob", "Qurghonteppa", "Istaravshan",
      "Vahdat", "Konibodom", "Tursunzoda", "Isfara", "Panjakent"
    ]
  },
  turkmenistan: {
    nameKey: "region.turkmenistan",
    cities: [
      "Ashgabat", "Türkmenabat", "Daşoguz", "Mary", "Balkanabat",
      "Bayramaly", "Türkmenbaşy", "Tejen", "Serdar", "Atamyrat"
    ]
  },
  afghanistan: {
    nameKey: "region.afghanistan",
    cities: [
      "Kabul", "Herat", "Mazar-i-Sharif", "Kandahar", "Jalalabad",
      "Kunduz", "Balkh", "Ghazni", "Baghlan", "Khost"
    ]
  }
};

interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discount_percent: number | null;
  discount_amount: number | null;
  min_order_weight: number | null;
}

interface CreateOrderFormProps {
  onSuccess?: () => void;
}

export const CreateOrderForm = ({ onSuccess }: CreateOrderFormProps) => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [cargoImages, setCargoImages] = useState<string[]>([]);
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");
  
  // Region/City selection state
  const [pickupRegion, setPickupRegion] = useState("");
  const [pickupCity, setPickupCity] = useState("");
  const [deliveryRegion, setDeliveryRegion] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");

  const orderSchema = useMemo(() => z.object({
    cargo_type: z.string().min(2, t("orders.cargoType")),
    weight: z.string().optional(),
    length: z.string().optional(),
    width: z.string().optional(),
    height: z.string().optional(),
    pickup_address: z.string().min(3, t("orders.pickupAddress")),
    delivery_address: z.string().min(3, t("orders.deliveryAddress")),
    pickup_date: z.date({ required_error: t("orders.pickupDate") }),
    description: z.string().optional(),
    client_price: z.string().optional(),
  }), [t]);

  type OrderFormValues = z.infer<typeof orderSchema>;

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      cargo_type: "",
      weight: "",
      length: "",
      width: "",
      height: "",
      pickup_address: "",
      delivery_address: "",
      description: "",
      client_price: "",
    },
  });

  // Get cities for selected region
  const pickupCities = pickupRegion 
    ? centralAsiaData[pickupRegion as keyof typeof centralAsiaData]?.cities || []
    : [];
  const deliveryCities = deliveryRegion 
    ? centralAsiaData[deliveryRegion as keyof typeof centralAsiaData]?.cities || []
    : [];

  // Update address when city changes
  const updatePickupAddress = (city: string) => {
    setPickupCity(city);
    if (pickupRegion && city) {
      const regionName = t(centralAsiaData[pickupRegion as keyof typeof centralAsiaData].nameKey);
      form.setValue("pickup_address", `${city}, ${regionName}`);
    }
  };

  const updateDeliveryAddress = (city: string) => {
    setDeliveryCity(city);
    if (deliveryRegion && city) {
      const regionName = t(centralAsiaData[deliveryRegion as keyof typeof centralAsiaData].nameKey);
      form.setValue("delivery_address", `${city}, ${regionName}`);
    }
  };

  const getDateLocale = () => {
    switch (language) {
      case "en": return enUS;
      default: return ru;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('uz-UZ').format(value) + " " + t("common.currency");
  };

  const applyPromoCode = async () => {
    if (!promoCode.trim()) return;
    
    setPromoLoading(true);
    setPromoError("");

    const { data, error } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("code", promoCode.trim().toUpperCase())
      .eq("is_active", true)
      .single();

    setPromoLoading(false);

    if (error || !data) {
      setPromoError(t("promo.invalid"));
      return;
    }

    if (data.max_uses && data.current_uses >= data.max_uses) {
      setPromoError(t("promo.expired"));
      return;
    }

    const weight = parseFloat(form.getValues("weight") || "0");
    if (data.min_order_weight && weight < data.min_order_weight) {
      setPromoError(`${t("orders.weight")}: ${data.min_order_weight} ${t("common.kg")}`);
      return;
    }

    const { data: usageData } = await supabase
      .from("promo_usages")
      .select("id")
      .eq("promo_code_id", data.id)
      .eq("user_id", user?.id)
      .single();

    if (usageData) {
      setPromoError(t("promo.alreadyUsed"));
      return;
    }

    setAppliedPromo(data);
    setPromoCode("");
    toast({
      title: t("promo.applied"),
      description: data.description || "",
    });
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoError("");
  };

  const getDiscountText = () => {
    if (!appliedPromo) return null;
    if (appliedPromo.discount_percent) {
      return `−${appliedPromo.discount_percent}%`;
    }
    if (appliedPromo.discount_amount) {
      return `−${formatCurrency(appliedPromo.discount_amount)}`;
    }
    return null;
  };

  const onSubmit = async (data: OrderFormValues) => {
    if (!user) return;

    setLoading(true);

    const { data: orderData, error } = await supabase.from("orders").insert({
      client_id: user.id,
      cargo_type: data.cargo_type,
      weight: data.weight ? parseFloat(data.weight) : null,
      length: data.length ? parseFloat(data.length) : null,
      width: data.width ? parseFloat(data.width) : null,
      height: data.height ? parseFloat(data.height) : null,
      pickup_address: data.pickup_address,
      delivery_address: data.delivery_address,
      pickup_date: data.pickup_date.toISOString(),
      description: data.description || null,
      photo_urls: cargoImages.length > 0 ? cargoImages : null,
      client_price: data.client_price ? parseFloat(data.client_price) : null,
    }).select().single();

    if (orderData) {
      supabase.functions.invoke("notify-new-order", {
        body: { orderId: orderData.id },
      }).catch(err => console.error("Failed to notify carriers:", err));
    }

    if (error) {
      setLoading(false);
      toast({
        title: t("common.cancel"),
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    if (appliedPromo && orderData) {
      const discountApplied = appliedPromo.discount_percent 
        ? appliedPromo.discount_percent 
        : (appliedPromo.discount_amount || 0);

      await supabase.from("promo_usages").insert({
        promo_code_id: appliedPromo.id,
        user_id: user.id,
        order_id: orderData.id,
        discount_applied: discountApplied,
      });

      await supabase
        .from("promo_codes")
        .update({ current_uses: (appliedPromo as any).current_uses + 1 })
        .eq("id", appliedPromo.id);
    }

    setLoading(false);
    toast({
      title: t("orders.create") + "!",
      description: appliedPromo ? t("promo.applied") : "",
    });
    form.reset();
    setCargoImages([]);
    setAppliedPromo(null);
    setPickupRegion("");
    setPickupCity("");
    setDeliveryRegion("");
    setDeliveryCity("");
    onSuccess?.();
  };

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          {t("orders.newOrder")}
        </CardTitle>
        <CardDescription>
          {t("orders.fillInfo")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Cargo Type */}
            <FormField
              control={form.control}
              name="cargo_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("orders.cargoType")} *</FormLabel>
                  <FormControl>
                    <Input placeholder={t("orders.cargoType")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Dimensions Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("orders.weight")} ({t("common.kg")})</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="length"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("orders.dimensions")} (м)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="width"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="opacity-0 hidden md:block">W</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="height"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="opacity-0 hidden md:block">H</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Pickup Location */}
            <div className="space-y-4 p-4 rounded-xl bg-driver/5 border border-driver/20">
              <div className="flex items-center gap-2 text-driver font-medium">
                <MapPin className="w-4 h-4" />
                {t("orders.pickupAddress")} *
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <Select value={pickupRegion} onValueChange={(val) => {
                  setPickupRegion(val);
                  setPickupCity("");
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("orders.selectRegion")} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(centralAsiaData).map(([key, data]) => (
                      <SelectItem key={key} value={key}>
                        {t(data.nameKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select 
                  value={pickupCity} 
                  onValueChange={updatePickupAddress}
                  disabled={!pickupRegion}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("orders.selectCity")} />
                  </SelectTrigger>
                  <SelectContent>
                    {pickupCities.map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <FormField
                control={form.control}
                name="pickup_address"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input 
                        placeholder={t("orders.pickupAddress")} 
                        {...field}
                        className="bg-background"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Delivery Location */}
            <div className="space-y-4 p-4 rounded-xl bg-customer/5 border border-customer/20">
              <div className="flex items-center gap-2 text-customer font-medium">
                <MapPin className="w-4 h-4" />
                {t("orders.deliveryAddress")} *
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <Select value={deliveryRegion} onValueChange={(val) => {
                  setDeliveryRegion(val);
                  setDeliveryCity("");
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("orders.selectRegion")} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(centralAsiaData).map(([key, data]) => (
                      <SelectItem key={key} value={key}>
                        {t(data.nameKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select 
                  value={deliveryCity} 
                  onValueChange={updateDeliveryAddress}
                  disabled={!deliveryRegion}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("orders.selectCity")} />
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryCities.map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <FormField
                control={form.control}
                name="delivery_address"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input 
                        placeholder={t("orders.deliveryAddress")} 
                        {...field}
                        className="bg-background"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Date Picker and Price */}
            <div className="grid md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="pickup_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t("orders.pickupDate")} *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP", { locale: getDateLocale() })
                            ) : (
                              <span>{t("orders.pickupDate")}</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="client_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("orders.clientPrice")} ({t("common.currency")})</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="1 000 000" 
                        {...field} 
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {t("orders.priceHint")}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Cargo Images */}
            <div className="space-y-2">
              <FormLabel>{t("orders.cargoPhoto")}</FormLabel>
              <CargoImageUpload
                images={cargoImages}
                onImagesChange={setCargoImages}
                maxImages={5}
              />
            </div>

            {/* Promo Code Section */}
            <div className="space-y-2">
              <FormLabel className="flex items-center gap-2">
                <Tag className="w-4 h-4" />
                {t("promo.title")}
              </FormLabel>
              
              {appliedPromo ? (
                <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20 animate-scale-in">
                  <Check className="w-5 h-5 text-primary" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{appliedPromo.code}</Badge>
                      <span className="text-sm font-medium text-primary">
                        {getDiscountText()}
                      </span>
                    </div>
                    {appliedPromo.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {appliedPromo.description}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={removePromo}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder={t("promo.title")}
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={applyPromoCode}
                    disabled={promoLoading || !promoCode.trim()}
                  >
                    {promoLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      t("promo.apply")
                    )}
                  </Button>
                </div>
              )}
              
              {promoError && (
                <p className="text-sm text-destructive animate-fade-in">{promoError}</p>
              )}
            </div>

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("orders.comment")}</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={t("orders.description")}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-medium transition-all hover:scale-[1.02]" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {t("common.loading")}
                </>
              ) : (
                <>
                  <Truck className="w-5 h-5 mr-2" />
                  {t("orders.create")}
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
