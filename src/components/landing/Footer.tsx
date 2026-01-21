import { Truck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export const Footer = () => {
  const { t } = useLanguage();

  const footerLinks = {
    product: {
      titleKey: "landing.footer.product",
      links: [
        { key: "landing.footer.features", href: "#features" },
        { key: "landing.footer.pricing", href: "#" },
        { key: "landing.footer.api", href: "#" },
      ],
    },
    company: {
      titleKey: "landing.footer.company",
      links: [
        { key: "landing.footer.about", href: "#" },
        { key: "landing.footer.careers", href: "#" },
        { key: "landing.footer.blog", href: "#" },
      ],
    },
    resources: {
      titleKey: "landing.footer.resources",
      links: [
        { key: "landing.footer.docs", href: "#" },
        { key: "landing.footer.support", href: "#" },
        { key: "landing.footer.faq", href: "#" },
      ],
    },
    legal: {
      titleKey: "landing.footer.legal",
      links: [
        { key: "landing.footer.terms", href: "#" },
        { key: "landing.footer.privacy", href: "#" },
      ],
    },
  };

  return (
    <footer className="bg-card border-t border-border py-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-12 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 gradient-hero rounded-xl flex items-center justify-center">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-foreground">
                Asia<span className="text-primary">Log</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              {t("landing.footer.description")}
            </p>
          </div>

          {/* Links */}
          {Object.values(footerLinks).map((section) => (
            <div key={section.titleKey}>
              <h4 className="font-semibold text-foreground mb-4">{t(section.titleKey)}</h4>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.key}>
                    <a href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {t(link.key)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © 2024 AsiaLog. {t("landing.footer.rights")}
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Telegram
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Instagram
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              YouTube
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
