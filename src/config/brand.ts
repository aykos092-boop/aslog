// Centralized Brand Configuration
// All branding constants in one place for easy updates

export const BRAND_CONFIG = {
  // Company Information
  name: "Asloguz",
  fullName: "Asloguz Logistics",
  tagline: "Professional Logistics Solutions",
  description: "Complete logistics management platform for modern businesses",
  version: "2.0.0",
  
  // URLs & Assets
  logo: "/logo.png", // Served from public folder
  logoAlt: "src/assets/logo.png", // ES6 import version
  favicon: "/logo.png",
  
  // URLs
  website: "https://asloguz.com",
  support: "mailto:support@asloguz.com",
  
  // SEO Configuration
  seo: {
    title: "Asloguz Logistics - Professional Transportation Solutions",
    description: "Complete logistics management platform for Central Asia. Real-time tracking, route optimization, and secure cargo transportation.",
    keywords: "logistics,transportation,cargo,shipping,central asia,uzbekistan,kazakhstan",
    author: "Asloguz Logistics Team",
    ogImage: "/og-image.png",
    twitterCard: "summary_large_image",
  },
  
  // Social media
  social: {
    facebook: "https://facebook.com/asloguz",
    twitter: "https://twitter.com/asloguz",
    linkedin: "https://linkedin.com/company/asloguz",
    instagram: "https://instagram.com/asloguz",
    telegram: "https://t.me/asloguz",
  },
  
  // Contact
  contact: {
    phone: "+998 90 123 45 67",
    email: "info@asloguz.com",
    address: "Tashkent, Uzbekistan"
  },
  
  // Features
  features: [
    "Real-time tracking",
    "Route optimization", 
    "Document management",
    "Multi-language support",
    "Mobile friendly",
    "Secure payments"
  ],
  
  // Theme Colors (HSL values for CSS)
  colors: {
    primary: "217 91% 60%", // Blue
    accent: "215 100% 50%",
    driver: "142 76% 36%", // Green for drivers
    company: "267 84% 61%", // Purple for companies  
    client: "217 91% 60%", // Blue for clients
  },
  
  // Currency
  currency: {
    code: "UZS",
    symbol: "сум",
    locale: "uz-UZ"
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

export type BrandConfig = typeof BRAND_CONFIG;

// Backward compatibility export
export const BRAND = BRAND_CONFIG;
