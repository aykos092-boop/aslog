import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Download, 
  Truck, 
  Package, 
  MapPin, 
  Clock, 
  DollarSign,
  User,
  Calendar,
  Phone,
  Mail,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface OrderData {
  id: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    company?: string;
    address: string;
  };
  route: {
    pickup: {
      address: string;
      coordinates: [number, number];
      contact: string;
      phone: string;
      timeWindow: string;
    };
    delivery: {
      address: string;
      coordinates: [number, number];
      contact: string;
      phone: string;
      timeWindow: string;
    };
    waypoints?: Array<{
      address: string;
      coordinates: [number, number];
      contact: string;
      phone: string;
    }>;
    distance: number;
    duration: number;
    estimatedCost: number;
  };
  cargo: {
    type: string;
    weight: number;
    dimensions: {
      length: number;
      width: number;
      height: number;
    };
    specialInstructions?: string;
    value?: number;
  };
  driver?: {
    name: string;
    phone: string;
    license: string;
    vehicle: string;
    plateNumber: string;
  };
  pricing: {
    basePrice: number;
    fuelSurcharge: number;
    tolls: number;
    additionalServices: number;
    total: number;
    currency: string;
  };
  timestamps: {
    created: string;
    accepted?: string;
    pickup?: string;
    delivery?: string;
    completed?: string;
  };
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  specialRequirements?: string[];
}

interface DocumentOptions {
  includeRouteDetails: boolean;
  includeCargoInfo: boolean;
  includePricingBreakdown: boolean;
  includeTermsAndConditions: boolean;
  includeCustomerSignature: boolean;
  includeDriverSignature: boolean;
  includeQRCode: boolean;
  includeInsuranceInfo: boolean;
}

export const OrderDocumentGenerator: React.FC<{
  orderData: OrderData;
  onDocumentGenerated?: (documentUrl: string) => void;
}> = ({ orderData, onDocumentGenerated }) => {
  const [documentOptions, setDocumentOptions] = useState<DocumentOptions>({
    includeRouteDetails: true,
    includeCargoInfo: true,
    includePricingBreakdown: true,
    includeTermsAndConditions: true,
    includeCustomerSignature: true,
    includeDriverSignature: true,
    includeQRCode: true,
    includeInsuranceInfo: false
  });

  const [isGenerating, setIsGenerating] = useState(false);

  const generateOrderPDF = async () => {
    setIsGenerating(true);
    
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      let yPosition = 20;

      // Helper function to add new page if needed
      const checkPageBreak = (requiredHeight: number) => {
        if (yPosition + requiredHeight > pdf.internal.pageSize.getHeight() - 20) {
          pdf.addPage();
          yPosition = 20;
        }
      };

      // Header
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('TRANSPORTATION ORDER', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Order ID: ${orderData.id}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      pdf.text(`Status: ${orderData.status.toUpperCase()}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Customer Information
      checkPageBreak(40);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('CUSTOMER INFORMATION', 20, yPosition);
      yPosition += 10;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Name: ${orderData.customer.name}`, 20, yPosition);
      yPosition += 6;
      pdf.text(`Email: ${orderData.customer.email}`, 20, yPosition);
      yPosition += 6;
      pdf.text(`Phone: ${orderData.customer.phone}`, 20, yPosition);
      yPosition += 6;
      pdf.text(`Address: ${orderData.customer.address}`, 20, yPosition);
      yPosition += 6;
      if (orderData.customer.company) {
        pdf.text(`Company: ${orderData.customer.company}`, 20, yPosition);
        yPosition += 6;
      }
      yPosition += 10;

      // Route Information
      if (documentOptions.includeRouteDetails) {
        checkPageBreak(60);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('ROUTE INFORMATION', 20, yPosition);
        yPosition += 10;

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Pickup Location:', 20, yPosition);
        yPosition += 6;
        pdf.setFont('helvetica', 'italic');
        pdf.text(orderData.route.pickup.address, 25, yPosition);
        yPosition += 6;
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Contact: ${orderData.route.pickup.contact} (${orderData.route.pickup.phone})`, 25, yPosition);
        yPosition += 6;
        pdf.text(`Time Window: ${orderData.route.pickup.timeWindow}`, 25, yPosition);
        yPosition += 10;

        pdf.text('Delivery Location:', 20, yPosition);
        yPosition += 6;
        pdf.setFont('helvetica', 'italic');
        pdf.text(orderData.route.delivery.address, 25, yPosition);
        yPosition += 6;
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Contact: ${orderData.route.delivery.contact} (${orderData.route.delivery.phone})`, 25, yPosition);
        yPosition += 6;
        pdf.text(`Time Window: ${orderData.route.delivery.timeWindow}`, 25, yPosition);
        yPosition += 10;

        pdf.text(`Distance: ${orderData.route.distance.toFixed(1)} km | Duration: ${Math.round(orderData.route.duration)} minutes`, 20, yPosition);
        yPosition += 15;
      }

      // Cargo Information
      if (documentOptions.includeCargoInfo) {
        checkPageBreak(40);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('CARGO INFORMATION', 20, yPosition);
        yPosition += 10;

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Type: ${orderData.cargo.type}`, 20, yPosition);
        yPosition += 6;
        pdf.text(`Weight: ${orderData.cargo.weight} kg`, 20, yPosition);
        yPosition += 6;
        pdf.text(`Dimensions: ${orderData.cargo.dimensions.length} × ${orderData.cargo.dimensions.width} × ${orderData.cargo.dimensions.height} cm`, 20, yPosition);
        yPosition += 6;
        if (orderData.cargo.specialInstructions) {
          pdf.text(`Special Instructions: ${orderData.cargo.specialInstructions}`, 20, yPosition);
          yPosition += 6;
        }
        if (orderData.cargo.value) {
          pdf.text(`Declared Value: ${orderData.cargo.value} ${orderData.pricing.currency}`, 20, yPosition);
          yPosition += 6;
        }
        yPosition += 10;
      }

      // Driver Information
      if (orderData.driver) {
        checkPageBreak(30);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('DRIVER INFORMATION', 20, yPosition);
        yPosition += 10;

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Name: ${orderData.driver.name}`, 20, yPosition);
        yPosition += 6;
        pdf.text(`Phone: ${orderData.driver.phone}`, 20, yPosition);
        yPosition += 6;
        pdf.text(`Vehicle: ${orderData.driver.vehicle} (${orderData.driver.plateNumber})`, 20, yPosition);
        yPosition += 15;
      }

      // Pricing Breakdown
      if (documentOptions.includePricingBreakdown) {
        checkPageBreak(40);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('PRICING BREAKDOWN', 20, yPosition);
        yPosition += 10;

        const pricingData = [
          ['Base Price', `${orderData.pricing.basePrice.toFixed(2)} ${orderData.pricing.currency}`],
          ['Fuel Surcharge', `${orderData.pricing.fuelSurcharge.toFixed(2)} ${orderData.pricing.currency}`],
          ['Tolls', `${orderData.pricing.tolls.toFixed(2)} ${orderData.pricing.currency}`],
          ['Additional Services', `${orderData.pricing.additionalServices.toFixed(2)} ${orderData.pricing.currency}`],
          ['TOTAL', `${orderData.pricing.total.toFixed(2)} ${orderData.pricing.currency}`]
        ];

        autoTable(pdf, {
          head: [['Item', 'Amount']],
          body: pricingData,
          startY: yPosition,
          theme: 'grid',
          styles: { fontSize: 10 },
          headStyles: { fillColor: [59, 130, 246] }
        });

        yPosition = (pdf as any).lastAutoTable.finalY + 15;
      }

      // Terms and Conditions
      if (documentOptions.includeTermsAndConditions) {
        checkPageBreak(60);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('TERMS AND CONDITIONS', 20, yPosition);
        yPosition += 10;

        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        const terms = [
          '1. The carrier is responsible for safe transportation of the cargo.',
          '2. Delivery times are estimates and may vary due to traffic, weather, or other unforeseen circumstances.',
          '3. The customer is responsible for providing accurate loading/unloading facilities.',
          '4. Insurance coverage is included up to the declared value of the cargo.',
          '5. Any claims for damage must be reported within 24 hours of delivery.',
          '6. Payment terms are net 30 days from invoice date.',
          '7. This document serves as a legally binding transportation agreement.'
        ];

        terms.forEach(term => {
          const lines = pdf.splitTextToSize(term, pageWidth - 40);
          lines.forEach((line: string) => {
            pdf.text(line, 20, yPosition);
            yPosition += 5;
          });
        });
        yPosition += 10;
      }

      // Signatures
      if (documentOptions.includeCustomerSignature || documentOptions.includeDriverSignature) {
        checkPageBreak(40);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('SIGNATURES', 20, yPosition);
        yPosition += 15;

        if (documentOptions.includeCustomerSignature) {
          pdf.line(20, yPosition + 20, 90, yPosition + 20);
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.text('Customer Signature', 20, yPosition + 25);
        }

        if (documentOptions.includeDriverSignature) {
          pdf.line(pageWidth - 90, yPosition + 20, pageWidth - 20, yPosition + 20);
          pdf.text('Driver Signature', pageWidth - 90, yPosition + 25);
        }

        yPosition += 40;
      }

      // Footer
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'italic');
      pdf.text(`Generated on ${new Date().toLocaleString()} | Swift Ship Connect Logistics`, pageWidth / 2, pdf.internal.pageSize.getHeight() - 10, { align: 'center' });

      // Save the PDF
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `order-${orderData.id}.pdf`;
      link.click();

      onDocumentGenerated?.(pdfUrl);
      
    } catch (error) {
      console.error('PDF generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateWaybill = () => {
    // Generate a simplified waybill document
    const pdf = new jsPDF();
    
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('WAYBILL', 105, 20, { align: 'center' });
    
    pdf.setFontSize(12);
    pdf.text(`Order ID: ${orderData.id}`, 20, 40);
    pdf.text(`Date: ${new Date().toLocaleDateString()}`, 20, 50);
    
    // Add essential waybill information
    pdf.setFontSize(10);
    pdf.text(`From: ${orderData.route.pickup.address}`, 20, 70);
    pdf.text(`To: ${orderData.route.delivery.address}`, 20, 80);
    pdf.text(`Cargo: ${orderData.cargo.type} (${orderData.cargo.weight}kg)`, 20, 90);
    
    pdf.save(`waybill-${orderData.id}.pdf`);
  };

  const generateInvoice = () => {
    // Generate invoice document
    const pdf = new jsPDF();
    
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('INVOICE', 105, 20, { align: 'center' });
    
    pdf.setFontSize(12);
    pdf.text(`Invoice #: INV-${orderData.id}`, 20, 40);
    pdf.text(`Date: ${new Date().toLocaleDateString()}`, 20, 50);
    
    pdf.text(`Bill To:`, 20, 70);
    pdf.text(orderData.customer.name, 20, 80);
    pdf.text(orderData.customer.address, 20, 90);
    
    pdf.save(`invoice-${orderData.id}.pdf`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <span>Document Generator</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Document Options</Label>
              <div className="space-y-2">
                {Object.entries({
                  includeRouteDetails: 'Route Details',
                  includeCargoInfo: 'Cargo Information',
                  includePricingBreakdown: 'Pricing Breakdown',
                  includeTermsAndConditions: 'Terms & Conditions',
                  includeCustomerSignature: 'Customer Signature',
                  includeDriverSignature: 'Driver Signature',
                  includeQRCode: 'QR Code',
                  includeInsuranceInfo: 'Insurance Information'
                }).map(([key, label]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={key}
                      checked={documentOptions[key as keyof DocumentOptions]}
                      onCheckedChange={(checked) => 
                        setDocumentOptions(prev => ({ ...prev, [key]: checked }))
                      }
                    />
                    <Label htmlFor={key} className="text-sm">{label}</Label>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <Label className="text-sm font-medium mb-2 block">Quick Actions</Label>
              <div className="space-y-2">
                <Button 
                  onClick={generateOrderPDF}
                  disabled={isGenerating}
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Generate Full Order Document
                    </>
                  )}
                </Button>
                
                <Button 
                  onClick={generateWaybill}
                  variant="outline"
                  className="w-full"
                >
                  <Truck className="w-4 h-4 mr-2" />
                  Generate Waybill
                </Button>
                
                <Button 
                  onClick={generateInvoice}
                  variant="outline"
                  className="w-full"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Generate Invoice
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5" />
            <span>Order Summary</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">Customer</span>
              </div>
              <p className="text-sm text-gray-600">{orderData.customer.name}</p>
              <p className="text-xs text-gray-500">{orderData.customer.phone}</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">Route</span>
              </div>
              <p className="text-sm text-gray-600">{orderData.route.distance.toFixed(1)} km</p>
              <p className="text-xs text-gray-500">{Math.round(orderData.route.duration)} min</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Package className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">Cargo</span>
              </div>
              <p className="text-sm text-gray-600">{orderData.cargo.type}</p>
              <p className="text-xs text-gray-500">{orderData.cargo.weight} kg</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">Total Cost</span>
              </div>
              <p className="text-sm font-bold text-green-600">
                {orderData.pricing.total.toFixed(2)} {orderData.pricing.currency}
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">Created</span>
              </div>
              <p className="text-sm text-gray-600">
                {new Date(orderData.timestamps.created).toLocaleDateString()}
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">Status</span>
              </div>
              <Badge variant={orderData.status === 'completed' ? 'default' : 'secondary'}>
                {orderData.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
          </div>
          
          {orderData.specialRequirements && orderData.specialRequirements.length > 0 && (
            <>
              <Separator className="my-4" />
              <div>
                <h4 className="text-sm font-medium mb-2">Special Requirements</h4>
                <div className="flex flex-wrap gap-2">
                  {orderData.specialRequirements.map((req, index) => (
                    <Badge key={index} variant="outline">{req}</Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
