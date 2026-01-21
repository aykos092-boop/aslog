import { Globe } from "lucide-react";
import { useLanguage, Language } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const languages: { code: Language; label: string; flag: string }[] = [
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "uz", label: "O'zbek", flag: "🇺🇿" },
  { code: "en", label: "English", flag: "🇺🇸" },
];

export const LanguageSwitcher = () => {
  const { language, setLanguage, t } = useLanguage();
  
  const currentLang = languages.find(l => l.code === language);

  const handleLanguageChange = (lang: Language) => {
    // Add transition class to body for smooth content transition
    document.body.classList.add('language-transition');
    
    setLanguage(lang);
    
    // Remove transition class after animation
    setTimeout(() => {
      document.body.classList.remove('language-transition');
    }, 300);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-2 transition-all duration-300 hover:scale-105"
        >
          <span className="text-lg transition-transform duration-300">{currentLang?.flag}</span>
          <span className="hidden sm:inline text-sm">{currentLang?.label}</span>
          <Globe className="w-4 h-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 animate-scale-in">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={cn(
              "flex items-center gap-3 cursor-pointer transition-all duration-200",
              language === lang.code && "bg-primary/10 text-primary font-medium"
            )}
          >
            <span className="text-lg">{lang.flag}</span>
            <span className="flex-1">{lang.label}</span>
            {language === lang.code && (
              <div className="w-2 h-2 rounded-full bg-primary animate-scale-in" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
