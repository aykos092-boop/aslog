import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon, Package, MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
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

interface CreateOrderFormProps {
  onSuccess?: () => void;
}

export const CreateOrderForm = ({ onSuccess }: CreateOrderFormProps) => {
  const [loading, setLoading] = useState(false);
  const [cargoImages, setCargoImages] = useState<string[]>([]);
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

  const onSubmit = async (data: OrderFormValues) => {
    if (!user) return;

    setLoading(true);

    const { error } = await supabase.from("orders").insert({
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
    });

    setLoading(false);

    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось создать заявку",
        variant: "destructive",
      });
      console.error("Order creation error:", error);
    } else {
      toast({
        title: "Заявка создана!",
        description: "Перевозчики уже могут откликнуться на неё",
      });
      form.reset();
      setCargoImages([]);
      onSuccess?.();
    }
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
