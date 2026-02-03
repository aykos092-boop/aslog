import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  CreditCard, 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Calendar,
  Receipt,
  Eye,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Payment {
  id: string;
  user_id: string;
  plan_name: string;
  amount: number;
  card_number: string;
  transaction_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  payment_method: string;
  created_at: string;
  processed_at?: string;
  processed_by?: string;
  notes?: string;
}

export const PaymentManager = () => {
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить платежи",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (payment: Payment) => {
    setSelectedPayment(payment);
    setAction('approve');
    setNotes('');
    setIsDialogOpen(true);
  };

  const handleReject = async (payment: Payment) => {
    setSelectedPayment(payment);
    setAction('reject');
    setNotes('');
    setIsDialogOpen(true);
  };

  const processPayment = async () => {
    if (!selectedPayment || !action) return;

    setProcessing(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      // Update payment status
      const { error: paymentError } = await supabase
        .from('payments')
        .update({
          status: action,
          processed_at: new Date().toISOString(),
          processed_by: userData.user?.id,
          notes: notes || null
        })
        .eq('id', selectedPayment.id);

      if (paymentError) throw paymentError;

      // If approved, create/update subscription
      if (action === 'approve') {
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1); // 1 month subscription

        const { error: subscriptionError } = await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: selectedPayment.user_id,
            plan_id: selectedPayment.plan_name.toLowerCase(),
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: periodEnd.toISOString(),
          }, {
            onConflict: 'user_id'
          });

        if (subscriptionError) throw subscriptionError;
      }

      toast({
        title: action === 'approve' ? "Платеж одобрен" : "Платеж отклонен",
        description: `Платеж #${selectedPayment.transaction_id} ${action === 'approve' ? 'одобрен и подписка активирована' : 'отклонен'}`,
      });

      setIsDialogOpen(false);
      setSelectedPayment(null);
      setAction(null);
      setNotes('');
      fetchPayments(); // Refresh list

    } catch (error) {
      console.error('Error processing payment:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось обработать платеж",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Ожидает</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Одобрен</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Отклонен</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-100 text-gray-800"><XCircle className="w-3 h-3 mr-1" />Отменен</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse text-center">Загрузка платежей...</div>
        </CardContent>
      </Card>
    );
  }

  const pendingPayments = payments.filter(p => p.status === 'pending');
  const processedPayments = payments.filter(p => p.status !== 'pending');

  return (
    <div className="space-y-6">
      {/* Pending Payments */}
      {pendingPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              Ожидают подтверждения ({pendingPayments.length})
            </CardTitle>
            <CardDescription>
              Платежи, требующие вашего подтверждения
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID транзакции</TableHead>
                  <TableHead>План</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead>Карта</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-mono text-sm">{payment.transaction_id}</TableCell>
                    <TableCell>{payment.plan_name}</TableCell>
                    <TableCell>{payment.amount.toLocaleString('ru-RU')} UZS</TableCell>
                    <TableCell>**** {payment.card_number}</TableCell>
                    <TableCell>
                      {format(new Date(payment.created_at), 'dd.MM.yyyy HH:mm', { locale: ru })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(payment)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Одобрить
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject(payment)}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Отклонить
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Processed Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Обработанные платежи ({processedPayments.length})
          </CardTitle>
          <CardDescription>
            История всех обработанных платежей
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID транзакции</TableHead>
                <TableHead>План</TableHead>
                <TableHead>Сумма</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Дата создания</TableHead>
                <TableHead>Дата обработки</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedPayments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-mono text-sm">{payment.transaction_id}</TableCell>
                  <TableCell>{payment.plan_name}</TableCell>
                  <TableCell>{payment.amount.toLocaleString('ru-RU')} UZS</TableCell>
                  <TableCell>{getStatusBadge(payment.status)}</TableCell>
                  <TableCell>
                    {format(new Date(payment.created_at), 'dd.MM.yyyy HH:mm', { locale: ru })}
                  </TableCell>
                  <TableCell>
                    {payment.processed_at ? 
                      format(new Date(payment.processed_at), 'dd.MM.yyyy HH:mm', { locale: ru }) : 
                      '-'
                    }
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedPayment(payment);
                        setAction(null);
                        setIsDialogOpen(true);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Детали
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Payment Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {action ? `${action === 'approve' ? 'Одобрение' : 'Отклонение'} платежа` : 'Детали платежа'}
            </DialogTitle>
            <DialogDescription>
              {selectedPayment && `Транзакция #${selectedPayment.transaction_id}`}
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">План:</span>
                  <p>{selectedPayment.plan_name}</p>
                </div>
                <div>
                  <span className="font-medium">Сумма:</span>
                  <p>{selectedPayment.amount.toLocaleString('ru-RU')} UZS</p>
                </div>
                <div>
                  <span className="font-medium">Карта:</span>
                  <p>**** {selectedPayment.card_number}</p>
                </div>
                <div>
                  <span className="font-medium">Статус:</span>
                  <p>{getStatusBadge(selectedPayment.status)}</p>
                </div>
              </div>

              {selectedPayment.notes && (
                <div>
                  <span className="font-medium">Примечания:</span>
                  <p className="text-sm text-muted-foreground">{selectedPayment.notes}</p>
                </div>
              )}

              {action && (
                <div>
                  <label className="text-sm font-medium">Примечания (необязательно)</label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Добавьте примечание к этому платежу..."
                    className="mt-1"
                  />
                </div>
              )}

              <div className="flex gap-2">
                {action && (
                  <>
                    <Button
                      onClick={processPayment}
                      disabled={processing}
                      className={action === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
                    >
                      {processing ? 'Обработка...' : action === 'approve' ? 'Одобрить' : 'Отклонить'}
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Закрыть
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
