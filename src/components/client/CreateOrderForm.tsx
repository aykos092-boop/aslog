import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon, Package, MapPin, Loader2, Tag, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
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

const orderSchema = z.object({
  cargo_type: z.string().min(2, "Укажите тип груза"),
  weight: z.string().optional(),
  length: z.string().optional(),
  width: z.string().optional(),
  height: z.string().optional(),
  pickup_address: z.string().min(5, "Укажите адрес погрузки"),
  delivery_address: z.string().min(5, "Укажите адрес выгрузки"),
  pickup_date: z.date({ required_error: "Выберите дату" }),
  description: z.string().optional(),
});

type OrderFormValues = z.infer<typeof orderSchema>;

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
  const [loading, setLoading] = useState(false);
  const [cargoImages, setCargoImages] = useState<string[]>([]);
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();

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
    },
  });

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
      setPromoError("Промокод не найден или недействителен");
      return;
    }

    // Check if max uses reached
    if (data.max_uses && data.current_uses >= data.max_uses) {
      setPromoError("Промокод исчерпан");
      return;
    }

    // Check min weight requirement
    const weight = parseFloat(form.getValues("weight") || "0");
    if (data.min_order_weight && weight < data.min_order_weight) {
      setPromoError(`Минимальный вес груза: ${data.min_order_weight} кг`);
      return;
    }

    // Check if already used by this user
    const { data: usageData } = await supabase
      .from("promo_usages")
      .select("id")
      .eq("promo_code_id", data.id)
      .eq("user_id", user?.id)
      .single();

    if (usageData) {
      setPromoError("Вы уже использовали этот промокод");
      return;
    }

    setAppliedPromo(data);
    setPromoCode("");
    toast({
      title: "Промокод применён!",
      description: data.description || "Скидка будет применена к заказу",
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
      return `−${appliedPromo.discount_amount.toLocaleString("ru-RU")} ₽`;
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
    }).select().single();

    if (error) {
      setLoading(false);
      toast({
        title: "Ошибка",
        description: "Не удалось создать заявку",
        variant: "destructive",
      });
      console.error("Order creation error:", error);
      return;
    }

    // Record promo usage if applied
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

      // Increment usage count
      await supabase
        .from("promo_codes")
        .update({ current_uses: (appliedPromo as any).current_uses + 1 })
        .eq("id", appliedPromo.id);
    }

    setLoading(false);
    toast({
      title: "Заявка создана!",
      description: appliedPromo 
        ? `Промокод ${appliedPromo.code} применён к заказу`
        : "Перевозчики уже могут откликнуться на неё",
    });
    form.reset();
    setCargoImages([]);
    setAppliedPromo(null);
    onSuccess?.();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          Новая заявка
        </CardTitle>
        <CardDescription>
          Заполните информацию о грузе и маршруте
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
                  <FormLabel>Тип груза *</FormLabel>
                  <FormControl>
                    <Input placeholder="Например: Мебель, Техника, Стройматериалы" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Dimensions Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Вес (кг)</FormLabel>
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
                    <FormLabel>Длина (м)</FormLabel>
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
                    <FormLabel>Ширина (м)</FormLabel>
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
                    <FormLabel>Высота (м)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Addresses */}
            <div className="grid md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="pickup_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-driver" />
                      Адрес погрузки *
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="г. Москва, ул. Примерная, д. 1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="delivery_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-customer" />
                      Адрес выгрузки *
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="г. Санкт-Петербург, пр. Невский, д. 10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Date Picker */}
            <FormField
              control={form.control}
              name="pickup_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Дата погрузки *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full md:w-[280px] pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: ru })
                          ) : (
                            <span>Выберите дату</span>
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
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Cargo Images */}
            <div className="space-y-2">
              <FormLabel>Фото груза</FormLabel>
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
                Промокод
              </FormLabel>
              
              {appliedPromo ? (
                <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
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
                    placeholder="Введите промокод"
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
                      "Применить"
                    )}
                  </Button>
                </div>
              )}
              
              {promoError && (
                <p className="text-sm text-destructive">{promoError}</p>
              )}
            </div>

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Комментарий</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Дополнительная информация о грузе, требования к перевозке..."
                      className="resize-none"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit */}
            <Button
              type="submit"
              variant="customer"
              size="lg"
              disabled={loading}
              className="w-full md:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Создание...
                </>
              ) : (
                <>
                  <Package className="w-4 h-4 mr-2" />
                  Создать заявку
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
