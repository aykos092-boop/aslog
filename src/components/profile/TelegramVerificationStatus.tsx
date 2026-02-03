import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageCircle, CheckCircle, AlertCircle, Link } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TelegramVerificationStatusProps {
  telegramVerified: boolean;
  telegramId?: number;
  telegramVerifiedAt?: string;
}

const TelegramVerificationStatus: React.FC<TelegramVerificationStatusProps> = ({
  telegramVerified,
  telegramId,
  telegramVerifiedAt
}) => {
  const navigate = useNavigate();

  if (telegramVerified) {
    return (
      <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-green-900">Telegram привязан</span>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Подтвержден
              </Badge>
            </div>
            <div className="text-sm text-green-700">
              ID: {telegramId}
              {telegramVerifiedAt && (
                <span className="ml-2">
                  • {new Date(telegramVerifiedAt).toLocaleDateString('ru-RU')}
                </span>
              )}
            </div>
          </div>
        </div>
        <MessageCircle className="w-5 h-5 text-green-600" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
          <AlertCircle className="w-5 h-5 text-yellow-600" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-yellow-900">Telegram не привязан</span>
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
              Не подтвержден
            </Badge>
          </div>
          <div className="text-sm text-yellow-700">
            Привяжите Telegram для получения уведомлений
          </div>
        </div>
      </div>
      <Button 
        size="sm" 
        variant="outline"
        onClick={() => navigate('/telegram-verification')}
        className="flex items-center gap-2"
      >
        <Link className="w-4 h-4" />
        Привязать
      </Button>
    </div>
  );
};

export default TelegramVerificationStatus;
