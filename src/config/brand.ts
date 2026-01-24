// Centralized Brand Configuration
// All branding constants in one place for easy updates

export const BRAND = {
  // Company Information
  name: "AsLogUz",
  fullName: "AsLogUz Global Logistics", 
  tagline: "Enterprise Logistics Platform",
  
  // URLs & Assets
  logo: "/logo.png", // Served from public folder
  logoAlt: "src/assets/logo.png", // ES6 import version
  favicon: "/logo.png",
  
  // Contact
  website: "https://asloguz.uz",
  email: "info@asloguz.uz",
  phone: "+998 71 200 00 00",
  
  // Theme Colors (HSL values for CSS)
  colors: {
    primary: "217 91% 60%", // Blue
    accent: "215 100% 50%",
    driver: "142 76% 36%", // Green for drivers
    company: "267 84% 61%", // Purple for companies  
    client: "217 91% 60%", // Blue for clients
  },
  
  // Social Links
  social: {
    telegram: "https://t.me/asloguz",
    instagram: "https://instagram.com/asloguz",
    facebook: "https://facebook.com/asloguz",
  },
  
  // Regions
  regions: [
    "Узбекистан",
    "Казахстан", 
    "Кыргызстан",
    "Таджикистан",
    "Туркменистан",
  ],
  
  // Legal
  copyright: `© ${new Date().getFullYear()} AsLogUz. Все права защищены.`,
} as const;

export type BrandConfig = typeof BRAND;
