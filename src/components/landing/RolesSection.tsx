import { Button } from "@/components/ui/button";
import { Building2, Truck, User, ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

const roles = [
  {
    id: "customer",
    icon: User,
    title: "Клиент",
    emoji: "🧑‍💼",
    description: "Человек или бизнес, которому нужно перевезти груз",
    features: [
      "Создание заявок за минуты",
      "Выбор водителя или компании",
      "Чат и отслеживание",
      "Оценка исполнителей",
    ],
    variant: "customer" as const,
    bgClass: "bg-customer-light",
    borderClass: "border-customer/20",
  },
  {
    id: "driver",
    icon: Truck,
    title: "Водитель",
    emoji: "🚚",
    description: "Независимый водитель с личным транспортом",
    features: [
      "Просмотр актуальных заявок",
      "Гибкий график работы",
      "Прямая связь с клиентом",
      "Рост рейтинга и дохода",
    ],
    variant: "driver" as const,
    bgClass: "bg-driver-light",
    borderClass: "border-driver/20",
  },
  {
    id: "company",
    icon: Building2,
    title: "Компания",
    emoji: "🏢",
    description: "Логистическая компания с командой водителей",
    features: [
      "Управление автопарком",
      "Распределение заказов",
      "Аналитика и отчёты",
      "Единый корпоративный рейтинг",
    ],
    variant: "company" as const,
    bgClass: "bg-company-light",
    borderClass: "border-company/20",
  },
];

export const RolesSection = () => {
  return (
    <section id="roles" className="py-24">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Платформа для каждого
          </h2>
          <p className="text-muted-foreground">
            Три типа пользователей — единая экосистема доверия
          </p>
        </div>

        {/* Roles Grid */}
        <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {roles.map((role, index) => (
            <div
              key={role.id}
              className={`relative rounded-3xl p-8 border-2 ${role.borderClass} ${role.bgClass} card-hover animate-fade-in`}
              style={{ animationDelay: `${index * 0.15}s` }}
            >
              {/* Role Icon & Title */}
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center gradient-${role.id}`}>
                  <role.icon className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{role.emoji}</span>
                    <h3 className="text-xl font-bold text-foreground">{role.title}</h3>
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="text-muted-foreground mb-6">
                {role.description}
              </p>

              {/* Features List */}
              <ul className="space-y-3 mb-8">
                {role.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm text-foreground">
                    <CheckCircle2 className={`w-5 h-5 text-${role.id} shrink-0`} />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <Link to="/auth">
                <Button variant={role.variant} className="w-full">
                  Начать как {role.title}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
