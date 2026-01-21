import { useState, useMemo } from "react";
import { Calculator, MapPin, Weight, Truck, Info, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Pricing constants
const BASE_RATE = 500;
const PRICE_PER_KM = 25;
const PRICE_PER_KG = 2;
const URGENCY_MULTIPLIER = 1.5;
const VOLUME_DISCOUNT_THRESHOLD = 1000;
const VOLUME_DISCOUNT = 0.15;

// City coordinates for distance calculation
const cityCoordinates: Record<string, { lat: number; lon: number; name: string }> = {
  "москва": { lat: 55.7558, lon: 37.6173, name: "Москва" },
  "санкт-петербург": { lat: 59.9343, lon: 30.3351, name: "Санкт-Петербург" },
  "новосибирск": { lat: 55.0084, lon: 82.9357, name: "Новосибирск" },
  "екатеринбург": { lat: 56.8389, lon: 60.6057, name: "Екатеринбург" },
  "казань": { lat: 55.7879, lon: 49.1233, name: "Казань" },
  "нижний новгород": { lat: 56.2965, lon: 43.9361, name: "Нижний Новгород" },
  "челябинск": { lat: 55.1644, lon: 61.4368, name: "Челябинск" },
  "самара": { lat: 53.1959, lon: 50.1002, name: "Самара" },
  "омск": { lat: 54.9885, lon: 73.3242, name: "Омск" },
  "ростов-на-дону": { lat: 47.2357, lon: 39.7015, name: "Ростов-на-Дону" },
  "уфа": { lat: 54.7388, lon: 55.9721, name: "Уфа" },
  "красноярск": { lat: 56.0153, lon: 92.8932, name: "Красноярск" },
  "воронеж": { lat: 51.6720, lon: 39.1843, name: "Воронеж" },
  "пермь": { lat: 58.0105, lon: 56.2502, name: "Пермь" },
  "волгоград": { lat: 48.7080, lon: 44.5133, name: "Волгоград" },
  "краснодар": { lat: 45.0355, lon: 38.9753, name: "Краснодар" },
  "саратов": { lat: 51.5330, lon: 46.0344, name: "Саратов" },
  "тюмень": { lat: 57.1553, lon: 65.5619, name: "Тюмень" },
  "тольятти": { lat: 53.5078, lon: 49.4204, name: "Тольятти" },
  "ижевск": { lat: 56.8527, lon: 53.2114, name: "Ижевск" },
  "сочи": { lat: 43.5855, lon: 39.7231, name: "Сочи" },
  "владивосток": { lat: 43.1155, lon: 131.8855, name: "Владивосток" },
  "иркутск": { lat: 52.2978, lon: 104.2964, name: "Иркутск" },
  "хабаровск": { lat: 48.4827, lon: 135.0839, name: "Хабаровск" },
};

const vehicleTypes = [
  { id: "auto", name: "Авто", priceMultiplier: 1 },
  { id: "car", name: "Легковой", priceMultiplier: 0.8, maxWeight: 500 },
  { id: "van", name: "Микроавтобус", priceMultiplier: 1, maxWeight: 1500 },
  { id: "truck_small", name: "Газель", priceMultiplier: 1.2, maxWeight: 3000 },
  { id: "truck_medium", name: "Грузовик 10т", priceMultiplier: 1.5, maxWeight: 10000 },
  { id: "truck_large", name: "Фура 20т", priceMultiplier: 2, maxWeight: 20000 },
];

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function findCity(address: string): { lat: number; lon: number; name: string } | null {
  const normalizedAddress = address.toLowerCase();
  for (const [city, coords] of Object.entries(cityCoordinates)) {
    if (normalizedAddress.includes(city)) {
      return coords;
    }
  }
  return null;
}

export const DeliveryCostCalculator = () => {
  const [mode, setMode] = useState<"manual" | "route">("manual");
  
  // Manual mode
  const [distance, setDistance] = useState<number>(100);
  const [weight, setWeight] = useState<number>(500);
  const [isUrgent, setIsUrgent] = useState(false);
  const [vehicleType, setVehicleType] = useState("auto");

  // Route mode
  const [fromCity, setFromCity] = useState("");
  const [toCity, setToCity] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(null);

  const selectedVehicle = vehicleTypes.find(v => v.id === vehicleType) || vehicleTypes[0];

  const calculateRoute = () => {
    setRouteError("");
    setCalculating(true);

    setTimeout(() => {
      const from = findCity(fromCity);
      const to = findCity(toCity);

      if (!from) {
        setRouteError(`Город "${fromCity}" не найден`);
        setCalculating(false);
        return;
      }
      if (!to) {
        setRouteError(`Город "${toCity}" не найден`);
        setCalculating(false);
        return;
      }

      const straight = haversineDistance(from.lat, from.lon, to.lat, to.lon);
      const road = Math.round(straight * 1.3);
      setCalculatedDistance(road);
      setDistance(road);
      setCalculating(false);
    }, 300);
  };

  const calculation = useMemo(() => {
    const effectiveDistance = mode === "route" && calculatedDistance ? calculatedDistance : distance;
    
    let cost = BASE_RATE;
    cost += effectiveDistance * PRICE_PER_KM;
    cost += weight * PRICE_PER_KG;
    
    // Vehicle multiplier
    cost *= selectedVehicle.priceMultiplier;
    
    let discount = 0;
    if (weight >= VOLUME_DISCOUNT_THRESHOLD) {
      discount = cost * VOLUME_DISCOUNT;
      cost -= discount;
    }
    
    if (isUrgent) {
      cost *= URGENCY_MULTIPLIER;
    }
    
    return {
      baseCost: BASE_RATE,
      distanceCost: effectiveDistance * PRICE_PER_KM,
      weightCost: weight * PRICE_PER_KG,
      vehicleMultiplier: selectedVehicle.priceMultiplier,
      discount: discount,
      urgencyExtra: isUrgent ? cost - (cost / URGENCY_MULTIPLIER) : 0,
      totalCost: Math.round(cost),
      effectiveDistance,
    };
  }, [distance, weight, isUrgent, mode, calculatedDistance, selectedVehicle]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const cityOptions = Object.values(cityCoordinates).map(c => c.name);

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
        <Tabs value={mode} onValueChange={(v) => setMode(v as "manual" | "route")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">По параметрам</TabsTrigger>
            <TabsTrigger value="route">По маршруту</TabsTrigger>
          </TabsList>

          <TabsContent value="route" className="space-y-4 pt-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  Откуда
                </Label>
                <Select value={fromCity} onValueChange={setFromCity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите город" />
                  </SelectTrigger>
                  <SelectContent>
                    {cityOptions.map((city) => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-destructive" />
                  Куда
                </Label>
                <Select value={toCity} onValueChange={setToCity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите город" />
                  </SelectTrigger>
                  <SelectContent>
                    {cityOptions.map((city) => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              onClick={calculateRoute} 
              disabled={calculating || !fromCity || !toCity}
              className="w-full"
            >
              {calculating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Calculator className="w-4 h-4 mr-2" />
              )}
              Рассчитать расстояние
            </Button>

            {routeError && (
              <p className="text-sm text-destructive text-center">{routeError}</p>
            )}

            {calculatedDistance && (
              <div className="p-3 rounded-lg bg-primary/10 text-center">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-1">
                  <span>{fromCity}</span>
                  <ArrowRight className="w-4 h-4" />
                  <span>{toCity}</span>
                </div>
                <p className="text-2xl font-bold">{calculatedDistance} км</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 pt-4">
            {/* Distance Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Расстояние
                </Label>
                <span className="text-sm font-medium">{distance} км</span>
              </div>
              <Slider
                value={[distance]}
                onValueChange={([value]) => setDistance(value)}
                min={10}
                max={3000}
                step={10}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>10 км</span>
                <span>3000 км</span>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Weight */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Weight className="h-4 w-4 text-muted-foreground" />
              Вес груза
            </Label>
            <span className="text-sm font-medium">{weight} кг</span>
          </div>
          <Slider
            value={[weight]}
            onValueChange={([value]) => setWeight(value)}
            min={1}
            max={20000}
            step={50}
          />
        </div>

        {/* Vehicle Type */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-muted-foreground" />
            Тип транспорта
          </Label>
          <Select value={vehicleType} onValueChange={setVehicleType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {vehicleTypes.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name} {v.maxWeight && `(до ${v.maxWeight / 1000}т)`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Manual Input */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Точное расстояние</Label>
            <Input
              type="number"
              value={distance}
              onChange={(e) => setDistance(Math.max(10, Math.min(5000, Number(e.target.value))))}
            />
          </div>
          <div className="space-y-2">
            <Label>Точный вес (кг)</Label>
            <Input
              type="number"
              value={weight}
              onChange={(e) => setWeight(Math.max(1, Math.min(20000, Number(e.target.value))))}
            />
          </div>
        </div>

        {/* Urgency */}
        <div
          className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
            isUrgent ? "bg-orange-500/10 border-orange-500" : "hover:bg-accent"
          }`}
          onClick={() => setIsUrgent(!isUrgent)}
        >
          <div className="flex items-center gap-2">
            <Truck className={`h-4 w-4 ${isUrgent ? "text-orange-500" : "text-muted-foreground"}`} />
            <span className="font-medium">Срочная доставка</span>
            <Badge variant={isUrgent ? "default" : "secondary"}>+50%</Badge>
          </div>
          <div className={`w-10 h-6 rounded-full transition-colors ${isUrgent ? "bg-orange-500" : "bg-muted"}`}>
            <div className={`w-5 h-5 mt-0.5 rounded-full bg-white transition-transform ${isUrgent ? "translate-x-4 ml-0.5" : "translate-x-0.5"}`} />
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
              За расстояние ({calculation.effectiveDistance} км)
            </span>
            <span>{formatCurrency(calculation.distanceCost)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">За вес ({weight} кг)</span>
            <span>{formatCurrency(calculation.weightCost)}</span>
          </div>
          {calculation.vehicleMultiplier !== 1 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{selectedVehicle.name}</span>
              <span>×{calculation.vehicleMultiplier}</span>
            </div>
          )}
          {calculation.discount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Скидка за объём</span>
              <span>−{formatCurrency(calculation.discount)}</span>
            </div>
          )}
          {calculation.urgencyExtra > 0 && (
            <div className="flex justify-between text-sm text-orange-600">
              <span>Срочность</span>
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

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 text-xs text-muted-foreground cursor-help">
                <Info className="h-3 w-3" />
                <span>Расчёт ориентировочный. Точную цену уточняйте у перевозчика</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>
                Фактическая стоимость может отличаться в зависимости от типа груза,
                условий погрузки/разгрузки и других факторов.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
};
