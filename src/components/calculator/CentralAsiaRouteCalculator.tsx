import { useState, useMemo } from "react";
import { 
  MapPin, Navigation, Truck, Calculator, DollarSign, 
  Banknote, ArrowRightLeft, Info 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Central Asian cities with coordinates
const centralAsianCities = {
  // Uzbekistan
  "Toshkent": { lat: 41.2995, lon: 69.2401, country: "UZ" },
  "Samarqand": { lat: 39.6542, lon: 66.9597, country: "UZ" },
  "Buxoro": { lat: 39.7747, lon: 64.4286, country: "UZ" },
  "Xiva": { lat: 41.3786, lon: 60.3638, country: "UZ" },
  "Urganch": { lat: 41.5500, lon: 60.6333, country: "UZ" },
  "Nukus": { lat: 42.4619, lon: 59.6003, country: "UZ" },
  "Andijon": { lat: 40.7821, lon: 72.3442, country: "UZ" },
  "Namangan": { lat: 40.9983, lon: 71.6726, country: "UZ" },
  "Farg'ona": { lat: 40.3864, lon: 71.7864, country: "UZ" },
  "Qarshi": { lat: 38.8600, lon: 65.8000, country: "UZ" },
  "Termiz": { lat: 37.2242, lon: 67.2783, country: "UZ" },
  "Navoiy": { lat: 40.0844, lon: 65.3792, country: "UZ" },
  "Jizzax": { lat: 40.1158, lon: 67.8422, country: "UZ" },
  "Guliston": { lat: 40.4897, lon: 68.7842, country: "UZ" },
  // Kazakhstan
  "Olmaota": { lat: 43.2220, lon: 76.8512, country: "KZ" },
  "Shymkent": { lat: 42.3417, lon: 69.5969, country: "KZ" },
  "Turkiston": { lat: 43.3019, lon: 68.2506, country: "KZ" },
  // Kyrgyzstan
  "Bishkek": { lat: 42.8746, lon: 74.5698, country: "KG" },
  "O'sh": { lat: 40.5283, lon: 72.7985, country: "KG" },
  // Tajikistan
  "Dushanbe": { lat: 38.5598, lon: 68.7740, country: "TJ" },
  "Xo'jand": { lat: 40.2826, lon: 69.6221, country: "TJ" },
  // Turkmenistan
  "Ashgabat": { lat: 37.9601, lon: 58.3261, country: "TM" },
  "Turkmenabod": { lat: 39.0733, lon: 63.5786, country: "TM" },
  // Afghanistan
  "Mozori Sharif": { lat: 36.7069, lon: 67.1149, country: "AF" },
  "Kobul": { lat: 34.5553, lon: 69.2075, country: "AF" },
};

const countryFlags: Record<string, string> = {
  UZ: "🇺🇿",
  KZ: "🇰🇿",
  KG: "🇰🇬",
  TJ: "🇹🇯",
  TM: "🇹🇲",
  AF: "🇦🇫",
};

// Pricing in UZS
const BASE_RATE_UZS = 50000; // Base rate
const PRICE_PER_KM_UZS = 1500; // Per km
const PRICE_PER_KG_UZS = 100; // Per kg
const CROSS_BORDER_FEE_UZS = 500000; // Cross-border fee

// Exchange rate (can be updated)
const USD_RATE = 12750;

type VehicleType = "gazelle" | "truck" | "trailer";

const vehicleConfig: Record<VehicleType, { name: string; multiplier: number; maxWeight: number }> = {
  gazelle: { name: "Gazel (1.5t)", multiplier: 1, maxWeight: 1500 },
  truck: { name: "Yuk mashinasi (5t)", multiplier: 1.5, maxWeight: 5000 },
  trailer: { name: "Fura (20t)", multiplier: 2.5, maxWeight: 20000 },
};

// Haversine formula
const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const CentralAsiaRouteCalculator = () => {
  const [fromCity, setFromCity] = useState<string>("");
  const [toCity, setToCity] = useState<string>("");
  const [weight, setWeight] = useState<number>(500);
  const [vehicleType, setVehicleType] = useState<VehicleType>("gazelle");
  const [showUSD, setShowUSD] = useState(false);

  const cities = Object.keys(centralAsianCities);

  const calculation = useMemo(() => {
    if (!fromCity || !toCity || fromCity === toCity) {
      return null;
    }

    const from = centralAsianCities[fromCity as keyof typeof centralAsianCities];
    const to = centralAsianCities[toCity as keyof typeof centralAsianCities];

    // Distance calculation (road distance ~ 1.3x straight line)
    const straightDistance = haversineDistance(from.lat, from.lon, to.lat, to.lon);
    const roadDistance = Math.round(straightDistance * 1.3);

    // Cross-border check
    const isCrossBorder = from.country !== to.country;

    // Vehicle config
    const vehicle = vehicleConfig[vehicleType];

    // Cost calculation
    const baseCost = BASE_RATE_UZS;
    const distanceCost = roadDistance * PRICE_PER_KM_UZS;
    const weightCost = weight * PRICE_PER_KG_UZS;
    const vehicleCost = (baseCost + distanceCost + weightCost) * (vehicle.multiplier - 1);
    const borderFee = isCrossBorder ? CROSS_BORDER_FEE_UZS : 0;

    const totalUZS = Math.round(baseCost + distanceCost + weightCost + vehicleCost + borderFee);
    const totalUSD = totalUZS / USD_RATE;

    return {
      distance: roadDistance,
      isCrossBorder,
      fromCountry: from.country,
      toCountry: to.country,
      baseCost,
      distanceCost,
      weightCost,
      vehicleCost,
      borderFee,
      totalUZS,
      totalUSD,
    };
  }, [fromCity, toCity, weight, vehicleType]);

  const formatCurrency = (amount: number, isUSD = showUSD) => {
    if (isUSD) {
      return `$${(amount / USD_RATE).toFixed(2)}`;
    }
    return `${amount.toLocaleString("ru-RU")} so'm`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          Yetkazib berish kalkulyatori
        </CardTitle>
        <CardDescription>
          Markaziy Osiyo shaharlari o'rtasida narxni hisoblang
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Route Selection */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-500" />
              Qayerdan
            </Label>
            <Select value={fromCity} onValueChange={setFromCity}>
              <SelectTrigger>
                <SelectValue placeholder="Shaharni tanlang" />
              </SelectTrigger>
              <SelectContent>
                {cities.map((city) => {
                  const data = centralAsianCities[city as keyof typeof centralAsianCities];
                  return (
                    <SelectItem key={city} value={city}>
                      {countryFlags[data.country]} {city}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-red-500" />
              Qayerga
            </Label>
            <Select value={toCity} onValueChange={setToCity}>
              <SelectTrigger>
                <SelectValue placeholder="Shaharni tanlang" />
              </SelectTrigger>
              <SelectContent>
                {cities.map((city) => {
                  const data = centralAsianCities[city as keyof typeof centralAsianCities];
                  return (
                    <SelectItem key={city} value={city} disabled={city === fromCity}>
                      {countryFlags[data.country]} {city}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Weight & Vehicle */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Yuk og'irligi (kg)</Label>
            <Input
              type="number"
              value={weight}
              onChange={(e) => setWeight(Math.max(1, parseInt(e.target.value) || 0))}
              min={1}
              max={vehicleConfig[vehicleType].maxWeight}
            />
            <p className="text-xs text-muted-foreground">
              Maks: {vehicleConfig[vehicleType].maxWeight.toLocaleString()} kg
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Transport turi
            </Label>
            <Select value={vehicleType} onValueChange={(v) => setVehicleType(v as VehicleType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(vehicleConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Currency Toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <Banknote className="w-4 h-4" />
            <span className="text-sm">Valyuta</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm ${!showUSD ? "font-bold" : ""}`}>UZS</span>
            <Switch checked={showUSD} onCheckedChange={setShowUSD} />
            <span className={`text-sm ${showUSD ? "font-bold" : ""}`}>USD</span>
          </div>
        </div>

        {/* Results */}
        {calculation && (
          <div className="space-y-4 pt-4 border-t">
            {/* Route Summary */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5">
              <div className="flex items-center gap-3">
                <div className="text-2xl">
                  {countryFlags[calculation.fromCountry]}
                </div>
                <ArrowRightLeft className="w-5 h-5 text-muted-foreground" />
                <div className="text-2xl">
                  {countryFlags[calculation.toCountry]}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Masofa</p>
                <p className="text-xl font-bold">{calculation.distance} km</p>
              </div>
            </div>

            {/* Cross-border warning */}
            {calculation.isCrossBorder && (
              <Badge variant="outline" className="w-full justify-center py-2">
                🛂 Xalqaro tashish - qo'shimcha chegara to'lovi
              </Badge>
            )}

            {/* Cost Breakdown */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bazaviy narx</span>
                <span>{formatCurrency(calculation.baseCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Masofa ({calculation.distance} km)</span>
                <span>{formatCurrency(calculation.distanceCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Og'irlik ({weight} kg)</span>
                <span>{formatCurrency(calculation.weightCost)}</span>
              </div>
              {calculation.vehicleCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transport ustamasi</span>
                  <span>{formatCurrency(calculation.vehicleCost)}</span>
                </div>
              )}
              {calculation.borderFee > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>Chegara to'lovi</span>
                  <span>{formatCurrency(calculation.borderFee)}</span>
                </div>
              )}
            </div>

            {/* Total */}
            <div className="p-4 rounded-lg bg-primary text-primary-foreground">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {showUSD ? (
                    <DollarSign className="w-5 h-5" />
                  ) : (
                    <Banknote className="w-5 h-5" />
                  )}
                  <span className="font-medium">Jami narx</span>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">
                    {showUSD 
                      ? `$${calculation.totalUSD.toFixed(2)}` 
                      : `${calculation.totalUZS.toLocaleString("ru-RU")} so'm`
                    }
                  </p>
                  <p className="text-xs opacity-80">
                    {showUSD 
                      ? `≈ ${calculation.totalUZS.toLocaleString("ru-RU")} so'm`
                      : `≈ $${calculation.totalUSD.toFixed(2)}`
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Disclaimer */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1 cursor-help">
                    <Info className="w-3 h-3" />
                    Taxminiy narx. Kurs: 1 USD = {USD_RATE.toLocaleString()} so'm
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Yakuniy narx transport turini va boshqa omillarni hisobga oladi</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
