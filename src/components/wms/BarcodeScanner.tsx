import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Camera, 
  Scan, 
  Upload, 
  CheckCircle, 
  AlertCircle,
  Package,
  MapPin
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ScanResult {
  code: string;
  type: string;
  reference_id: string;
  reference_type: string;
  reference_data?: any;
}

const BarcodeScanner = () => {
  const { t } = useLanguage();
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Cleanup camera when component unmounts
    return () => {
      if (isScanning) {
        stopCamera();
      }
    };
  }, [isScanning]);

  const startCamera = async () => {
    try {
      setIsScanning(true);
      setError(null);
      // In a real implementation, you would initialize camera here
      // For now, we'll simulate camera functionality
      console.log("Starting camera for barcode scanning...");
    } catch (error) {
      setError(t("wms.barcode.cameraError", "Failed to access camera"));
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    setIsScanning(false);
    // Stop camera stream
    console.log("Stopping camera...");
  };

  const handleScan = async (code: string) => {
    setLoading(true);
    setError(null);

    try {
      // Look up barcode in database
      const { data, error } = await supabase
        .from('barcodes')
        .select(`
          *,
          products!inner(sku, name, category),
          locations!inner(code, rack, shelf)
        `)
        .eq('code', code)
        .eq('is_active', true)
        .single();

      if (error) {
        setError(t("wms.barcode.notFound", "Barcode not found in system"));
        return;
      }

      // Get additional reference data based on type
      let referenceData = null;
      if (data.reference_type === 'product') {
        const { data: productData } = await supabase
          .from('products')
          .select('*')
          .eq('id', data.reference_id)
          .single();
        referenceData = productData;
      } else if (data.reference_type === 'location') {
        const { data: locationData } = await supabase
          .from('locations')
          .select(`
            *,
            zones!inner(name, warehouse_id),
            warehouses!inner(name, code)
          `)
          .eq('id', data.reference_id)
          .single();
        referenceData = locationData;
      }

      setScanResult({
        code: data.code,
        type: data.type,
        reference_id: data.reference_id,
        reference_type: data.reference_type,
        reference_data: referenceData
      });
    } catch (error) {
      setError(t("wms.barcode.scanError", "Failed to process barcode"));
    } finally {
      setLoading(false);
    }
  };

  const handleManualInput = () => {
    if (manualCode.trim()) {
      handleScan(manualCode.trim());
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      // In a real implementation, you would process the image file
      // and extract barcode/QR code using a library like ZXing
      console.log("Processing file for barcode scanning...");
      
      // For now, simulate finding a barcode
      const simulatedCode = "SIM-" + Date.now();
      handleScan(simulatedCode);
    } catch (error) {
      setError(t("wms.barcode.fileError", "Failed to process image file"));
    } finally {
      setLoading(false);
    }
  };

  const getReferenceIcon = (type: string) => {
    switch (type) {
      case 'product':
        return <Package className="w-5 h-5" />;
      case 'location':
        return <MapPin className="w-5 h-5" />;
      default:
        return <Scan className="w-5 h-5" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'product':
        return <Badge variant="default">{t("wms.barcode.product", "Product")}</Badge>;
      case 'location':
        return <Badge variant="secondary">{t("wms.barcode.location", "Location")}</Badge>;
      case 'pallet':
        return <Badge variant="outline">{t("wms.barcode.pallet", "Pallet")}</Badge>;
      case 'package':
        return <Badge variant="outline">{t("wms.barcode.package", "Package")}</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">{t("wms.barcode.title", "Barcode Scanner")}</h2>
        <p className="text-muted-foreground">
          {t("wms.barcode.subtitle", "Scan barcodes and QR codes for products and locations")}
        </p>
      </div>

      {/* Scanner Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={startCamera}>
          <CardHeader className="text-center">
            <Camera className="w-8 h-8 mx-auto mb-2" />
            <CardTitle className="text-lg">{t("wms.barcode.camera", "Camera Scan")}</CardTitle>
            <CardDescription>
              {t("wms.barcode.cameraDesc", "Use device camera to scan barcodes")}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button 
              variant={isScanning ? "destructive" : "default"}
              onClick={(e) => {
                e.stopPropagation();
                isScanning ? stopCamera() : startCamera();
              }}
            >
              {isScanning ? t("wms.barcode.stop", "Stop") : t("wms.barcode.start", "Start")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <Scan className="w-8 h-8 mx-auto mb-2" />
            <CardTitle className="text-lg">{t("wms.barcode.manual", "Manual Input")}</CardTitle>
            <CardDescription>
              {t("wms.barcode.manualDesc", "Enter barcode code manually")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input
              placeholder={t("wms.barcode.enterCode", "Enter barcode code")}
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleManualInput()}
            />
            <Button 
              className="w-full" 
              onClick={handleManualInput}
              disabled={!manualCode.trim()}
            >
              {t("wms.barcode.lookup", "Lookup")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <Upload className="w-8 h-8 mx-auto mb-2" />
            <CardTitle className="text-lg">{t("wms.barcode.upload", "Upload Image")}</CardTitle>
            <CardDescription>
              {t("wms.barcode.uploadDesc", "Upload image containing barcode")}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
            >
              {t("wms.barcode.selectFile", "Select File")}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Camera View */}
      {isScanning && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              {t("wms.barcode.scanning", "Scanning...")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-black rounded-lg aspect-video flex items-center justify-center">
              <div className="text-white text-center">
                <Scan className="w-16 h-16 mx-auto mb-4 animate-pulse" />
                <p>{t("wms.barcode.alignBarcode", "Align barcode with camera")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scan Result */}
      {scanResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              {t("wms.barcode.scanResult", "Scan Result")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getReferenceIcon(scanResult.reference_type)}
                <div>
                  <div className="font-medium">{scanResult.code}</div>
                  <div className="text-sm text-muted-foreground">
                    {t("wms.barcode.scannedAt", "Scanned at")} {new Date().toLocaleString()}
                  </div>
                </div>
              </div>
              {getTypeBadge(scanResult.type)}
            </div>

            {scanResult.reference_data && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">
                  {t("wms.barcode.referenceInfo", "Reference Information")}
                </h4>
                
                {scanResult.reference_type === 'product' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">{t("wms.barcode.name", "Name")}:</span>
                      <div className="font-medium">{scanResult.reference_data.name}</div>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">{t("wms.barcode.sku", "SKU")}:</span>
                      <div className="font-medium">{scanResult.reference_data.sku}</div>
                    </div>
                    {scanResult.reference_data.category && (
                      <div>
                        <span className="text-sm text-muted-foreground">{t("wms.barcode.category", "Category")}:</span>
                        <div className="font-medium">{scanResult.reference_data.category}</div>
                      </div>
                    )}
                    {scanResult.reference_data.weight && (
                      <div>
                        <span className="text-sm text-muted-foreground">{t("wms.barcode.weight", "Weight")}:</span>
                        <div className="font-medium">{scanResult.reference_data.weight} kg</div>
                      </div>
                    )}
                  </div>
                )}

                {scanResult.reference_type === 'location' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">{t("wms.barcode.locationCode", "Location Code")}:</span>
                      <div className="font-medium">{scanResult.reference_data.code}</div>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">{t("wms.barcode.rackShelf", "Rack/Shelf")}:</span>
                      <div className="font-medium">{scanResult.reference_data.rack}-{scanResult.reference_data.shelf}</div>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">{t("wms.barcode.zone", "Zone")}:</span>
                      <div className="font-medium">{scanResult.reference_data.zones?.name}</div>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">{t("wms.barcode.warehouse", "Warehouse")}:</span>
                      <div className="font-medium">{scanResult.reference_data.warehouses?.name}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setScanResult(null)}>
                {t("wms.barcode.newScan", "New Scan")}
              </Button>
              <Button>
                {t("wms.barcode.viewDetails", "View Details")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
              <span>{t("wms.barcode.processing", "Processing barcode...")}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export { BarcodeScanner };
