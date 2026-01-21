import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export const CTASection = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 gradient-hero opacity-95" />
      
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-full h-full"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      {/* Floating Elements */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl animate-float" />
      <div className="absolute bottom-10 right-10 w-48 h-48 bg-white/10 rounded-full blur-2xl animate-float" style={{ animationDelay: "1s" }} />

      <div className="container mx-auto px-4 relative">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 text-white text-sm font-medium mb-8">
            <Sparkles className="w-4 h-4" />
            Бесплатный старт
          </div>

          {/* Heading */}
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
            Готовы начать?
          </h2>

          {/* Subheading */}
          <p className="text-lg md:text-xl text-white/80 mb-10 max-w-xl mx-auto">
            Присоединяйтесь к платформе LogiFlow и откройте новые возможности для вашего бизнеса
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/auth">
              <Button variant="glass" size="xl" className="bg-white text-primary hover:bg-white/90">
                Создать аккаунт
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <Button variant="glass" size="xl">
              Связаться с нами
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="mt-12 flex items-center justify-center gap-8 text-white/60 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-driver" />
              Бесплатная регистрация
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-driver" />
              Без скрытых платежей
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
