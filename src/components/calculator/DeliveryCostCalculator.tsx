import { useState, useMemo } from "react";
import { Calculator, MapPin, Weight, Truck, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Pricing constants (can be adjusted)
const BASE_RATE = 500; // Base cost in rubles
const PRICE_PER_KM = 25; // Rubles per kilometer
const PRICE_PER_KG = 2; // Rubles per kilogram
const URGENCY_MULTIPLIER = 1.5; // Multiplier for urgent delivery
const VOLUME_DISCOUNT_THRESHOLD = 1000; // kg threshold for volume discount
const VOLUME_DISCOUNT = 0.15; // 15% discount for large loads

export const DeliveryCostCalculator = () => {
  const [distance, setDistance] = useState<number>(100);
  const [weight, setWeight] = useState<number>(500);
  const [isUrgent, setIsUrgent] = useState(false);

  const calculation = useMemo(() => {
    // Base cost
    let cost = BASE_RATE;
    
    // Add distance cost
    cost += distance * PRICE_PER_KM;
    
    // Add weight cost
    cost += weight * PRICE_PER_KG;
    
    // Apply volume discount for large loads
    let discount = 0;
    if (weight >= VOLUME_DISCOUNT_THRESHOLD) {
      discount = cost * VOLUME_DISCOUNT;
      cost -= discount;
    }
    
    // Apply urgency multiplier
    if (isUrgent) {
      cost *= URGENCY_MULTIPLIER;
    }
    
    return {
      baseCost: BASE_RATE,
      distanceCost: distance * PRICE_PER_KM,
      weightCost: weight * PRICE_PER_KG,
      discount: discount,
      urgencyExtra: isUrgent ? cost - (cost / URGENCY_MULTIPLIER) : 0,
      totalCost: Math.round(cost),
    };
  }, [distance, weight, isUrgent]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          Калькулятор стоимости
        </CardTitle>
        <CardDescription>
          Примерный расчёт стоимости доставки
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Distance Input */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Расстояние (км)
            </Label>
            <span className="text-sm font-medium">{distance} км</span>
          </div>
          <Slider
            value={[distance]}
            onValueChange={([value]) => setDistance(value)}
            min={10}
            max={3000}
            step={10}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>10 км</span>
            <span>3000 км</span>
          </div>
        </div>

        {/* Weight Input */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Weight className="h-4 w-4 text-muted-foreground" />
              Вес груза (кг)
            </Label>
            <span className="text-sm font-medium">{weight} кг</span>
          </div>
          <Slider
            value={[weight]}
            onValueChange={([value]) => setWeight(value)}
            min={1}
            max={20000}
            step={50}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1 кг</span>
            <span>20 т</span>
          </div>
        </div>

        {/* Manual Input Option */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="distance-input">Точное расстояние</Label>
            <Input
              id="distance-input"
              type="number"
              value={distance}
              onChange={(e) => setDistance(Math.max(10, Math.min(3000, Number(e.target.value))))}
              min={10}
              max={3000}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weight-input">Точный вес</Label>
            <Input
              id="weight-input"
              type="number"
              value={weight}
              onChange={(e) => setWeight(Math.max(1, Math.min(20000, Number(e.target.value))))}
              min={1}
              max={20000}
            />
          </div>
        </div>

        {/* Urgency Toggle */}
        <div
          className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
            isUrgent ? "bg-orange-500/10 border-orange-500" : "hover:bg-accent"
          }`}
          onClick={() => setIsUrgent(!isUrgent)}
        >
          <div className="flex items-center gap-2">
            <Truck className={`h-4 w-4 ${isUrgent ? "text-orange-500" : "text-muted-foreground"}`} />
            <span className="font-medium">Срочная доставка</span>
            <Badge variant={isUrgent ? "default" : "secondary"} className="text-xs">
              +50%
            </Badge>
          </div>
          <div className={`w-10 h-6 rounded-full transition-colors ${
            isUrgent ? "bg-orange-500" : "bg-muted"
          }`}>
            <div className={`w-5 h-5 mt-0.5 rounded-full bg-white transition-transform ${
              isUrgent ? "translate-x-4.5 ml-0.5" : "translate-x-0.5"
            }`} />
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="space-y-2 p-4 rounded-lg bg-muted/50">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Базовая ставка</span>
            <span>{formatCurrency(calculation.baseCost)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              За расстояние ({distance} км × {PRICE_PER_KM}₽)
            </span>
            <span>{formatCurrency(calculation.distanceCost)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              За вес ({weight} кг × {PRICE_PER_KG}₽)
            </span>
            <span>{formatCurrency(calculation.weightCost)}</span>
          </div>
          {calculation.discount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Скидка за объём (−15%)</span>
              <span>−{formatCurrency(calculation.discount)}</span>
            </div>
          )}
          {calculation.urgencyExtra > 0 && (
            <div className="flex justify-between text-sm text-orange-600">
              <span>Срочность (+50%)</span>
              <span>+{formatCurrency(calculation.urgencyExtra)}</span>
            </div>
          )}
          <div className="border-t pt-2 mt-2">
            <div className="flex justify-between items-center">
              <span className="font-medium">Итого:</span>
              <span className="text-2xl font-bold text-primary">
                {formatCurrency(calculation.totalCost)}
              </span>
            </div>
          </div>
        </div>

        {/* Info */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 text-xs text-muted-foreground cursor-help">
                <Info className="h-3 w-3" />
                <span>Расчёт является ориентировочным</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>
                Фактическая стоимость может отличаться в зависимости от типа груза,
                условий погрузки/разгрузки, времени года и других факторов.
                Точную цену уточняйте у перевозчика.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
};
