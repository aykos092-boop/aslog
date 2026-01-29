import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { MapboxAutocomplete } from '@/components/map/MapboxAutocomplete';
import { MapboxRouteMap } from '@/components/map/MapboxRouteMap';
import { RouteOptimizer } from '@/components/logistics/RouteOptimizer';
import { OrderDocumentGenerator } from '@/components/documents/OrderDocumentGenerator';
import { 
  Truck, 
  Package, 
  Route, 
  FileText, 
  Plus, 
  Search,
  Clock,
  MapPin,
  DollarSign,
  TrendingUp,
  Users,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

interface RoutePoint {
  id: string;
  coordinates: [number, number];
  address: string;
  type: 'pickup' | 'delivery' | 'waypoint';
  priority: 'high' | 'medium' | 'low';
  timeWindow?: {
    start: string;
    end: string;
  };
}

interface Order {
  id: string;
  customer: string;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  route: {
    pickup: string;
    delivery: string;
    distance: number;
    duration: number;
  };
  cargo: {
    type: string;
    weight: number;
  };
  price: number;
  createdAt: string;
}

const mockOrders: Order[] = [
  {
    id: 'ORD-001',
    customer: 'ABC Logistics',
    status: 'pending',
    route: {
      pickup: 'Moscow, Russia',
      delivery: 'St. Petersburg, Russia',
      distance: 712,
      duration: 540
    },
    cargo: {
      type: 'Electronics',
      weight: 250
    },
    price: 1250,
    createdAt: '2024-01-29T10:30:00Z'
  },
  {
    id: 'ORD-002',
    customer: 'XYZ Trading',
    status: 'accepted',
    route: {
      pickup: 'Kazan, Russia',
      delivery: 'Nizhny Novgorod, Russia',
      distance: 425,
      duration: 320
    },
    cargo: {
      type: 'Food Products',
      weight: 500
    },
    price: 850,
    createdAt: '2024-01-29T09:15:00Z'
  },
  {
    id: 'ORD-003',
    customer: 'Global Shipping Co',
    status: 'in_progress',
    route: {
      pickup: 'Yekaterinburg, Russia',
      delivery: 'Chelyabinsk, Russia',
      distance: 210,
      duration: 180
    },
    cargo: {
      type: 'Machinery Parts',
      weight: 1200
    },
    price: 2100,
    createdAt: '2024-01-29T08:00:00Z'
  }
];

export const LogisticsDashboard: React.FC = () => {
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const handleLocationAdd = (location: {
    coordinates: [number, number];
    address: string;
    placeName: string;
  }) => {
    const newPoint: RoutePoint = {
      id: `point-${Date.now()}`,
      coordinates: location.coordinates,
      address: location.address,
      type: routePoints.length === 0 ? 'pickup' : routePoints.length === 1 ? 'delivery' : 'waypoint',
      priority: 'medium',
      timeWindow: {
        start: '09:00',
        end: '17:00'
      }
    };
    
    setRoutePoints(prev => [...prev, newPoint]);
  };

  const handleRouteUpdate = (routeInfo: any) => {
    console.log('Route updated:', routeInfo);
  };

  const handleOptimizationComplete = (result: any) => {
    console.log('Optimization complete:', result);
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'accepted': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'accepted': return <CheckCircle className="w-4 h-4" />;
      case 'in_progress': return <Truck className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'cancelled': return <AlertTriangle className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const mockOrderData = {
    id: selectedOrder?.id || 'ORD-001',
    customer: {
      name: selectedOrder?.customer || 'ABC Logistics',
      email: 'customer@example.com',
      phone: '+7 495 123-45-67',
      company: selectedOrder?.customer || 'ABC Logistics',
      address: 'Moscow, Russia'
    },
    route: {
      pickup: {
        address: selectedOrder?.route.pickup || 'Moscow, Russia',
        coordinates: [37.6173, 55.7558] as [number, number],
        contact: 'John Doe',
        phone: '+7 495 123-45-67',
        timeWindow: '09:00 - 11:00'
      },
      delivery: {
        address: selectedOrder?.route.delivery || 'St. Petersburg, Russia',
        coordinates: [30.3158, 59.9343] as [number, number],
        contact: 'Jane Smith',
        phone: '+7 812 987-65-43',
        timeWindow: '15:00 - 17:00'
      },
      distance: selectedOrder?.route.distance || 712,
      duration: selectedOrder?.route.duration || 540,
      estimatedCost: selectedOrder?.price || 1250
    },
    cargo: {
      type: selectedOrder?.cargo.type || 'Electronics',
      weight: selectedOrder?.cargo.weight || 250,
      dimensions: {
        length: 120,
        width: 80,
        height: 60
      },
      specialInstructions: 'Handle with care. Fragile electronics.',
      value: 50000
    },
    driver: {
      name: 'Ivan Petrov',
      phone: '+7 916 111-22-33',
      license: 'AB123456',
      vehicle: 'Volvo FH16',
      plateNumber: 'A777BC'
    },
    pricing: {
      basePrice: 1000,
      fuelSurcharge: 150,
      tolls: 50,
      additionalServices: 50,
      total: selectedOrder?.price || 1250,
      currency: 'RUB'
    },
    timestamps: {
      created: selectedOrder?.createdAt || '2024-01-29T10:30:00Z',
      accepted: '2024-01-29T11:00:00Z'
    },
    status: selectedOrder?.status || 'pending',
    specialRequirements: ['Temperature control', 'Insurance required']
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Logistics Dashboard</h1>
            <p className="text-gray-600 mt-1">Manage routes, optimize deliveries, and generate documents</p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Order
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Orders</p>
                  <p className="text-2xl font-bold text-gray-900">12</p>
                </div>
                <div className="bg-blue-100 p-3 rounded-full">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">In Transit</p>
                  <p className="text-2xl font-bold text-gray-900">8</p>
                </div>
                <div className="bg-green-100 p-3 rounded-full">
                  <Truck className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Distance</p>
                  <p className="text-2xl font-bold text-gray-900">2,847 km</p>
                </div>
                <div className="bg-purple-100 p-3 rounded-full">
                  <Route className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">₽185,400</p>
                </div>
                <div className="bg-yellow-100 p-3 rounded-full">
                  <DollarSign className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="route-planning">Route Planning</TabsTrigger>
            <TabsTrigger value="optimization">Optimization</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Users className="w-5 h-5" />
                    <span>Recent Orders</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mockOrders.map((order) => (
                      <div 
                        key={order.id} 
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{order.id}</span>
                            <Badge className={getStatusColor(order.status)}>
                              {getStatusIcon(order.status)}
                              <span className="ml-1">{order.status.replace('_', ' ')}</span>
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{order.customer}</p>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                            <span className="flex items-center">
                              <MapPin className="w-3 h-3 mr-1" />
                              {order.route.distance} km
                            </span>
                            <span className="flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {Math.round(order.route.duration / 60)}h
                            </span>
                            <span className="flex items-center">
                              <Package className="w-3 h-3 mr-1" />
                              {order.route.pickup} → {order.route.delivery}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">₽{order.price}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5" />
                    <span>Performance Metrics</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">On-Time Delivery</span>
                      <span className="font-bold text-green-600">94.5%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Average Delivery Time</span>
                      <span className="font-bold">2.3 hours</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Fuel Efficiency</span>
                      <span className="font-bold">7.8 L/100km</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Customer Satisfaction</span>
                      <span className="font-bold text-blue-600">4.8/5.0</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="route-planning" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Route className="w-5 h-5" />
                  <span>Route Planning</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Add Location</label>
                    <MapboxAutocomplete
                      onLocationSelect={handleLocationAdd}
                      placeholder="Enter pickup or delivery address..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Route Points</label>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {routePoints.map((point, index) => (
                        <div key={point.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center space-x-2">
                            <Badge variant={point.type === 'pickup' ? 'default' : point.type === 'delivery' ? 'destructive' : 'secondary'}>
                              {point.type}
                            </Badge>
                            <span className="text-sm">{point.address}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setRoutePoints(prev => prev.filter(p => p.id !== point.id))}
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                {routePoints.length >= 2 && (
                  <MapboxRouteMap
                    routePoints={routePoints}
                    onRouteUpdate={handleRouteUpdate}
                    height="500px"
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="optimization" className="space-y-6">
            <RouteOptimizer
              routePoints={routePoints}
              onOptimizationComplete={handleOptimizationComplete}
            />
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
            <OrderDocumentGenerator
              orderData={mockOrderData}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
