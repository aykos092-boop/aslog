import { Helmet } from 'react-helmet-async';
import { BRAND_CONFIG } from '@/config/brand';

interface SEOMetaProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  canonical?: string;
  noIndex?: boolean;
  type?: 'website' | 'article';
}

export const SEOMeta: React.FC<SEOMetaProps> = ({
  title,
  description,
  keywords,
  ogImage,
  canonical,
  noIndex = false,
  type = 'website'
}) => {
  const siteTitle = title ? `${title} | ${BRAND_CONFIG.fullName}` : BRAND_CONFIG.seo.title;
  const siteDescription = description || BRAND_CONFIG.seo.description;
  const siteKeywords = keywords || BRAND_CONFIG.seo.keywords;
  const siteImage = ogImage || BRAND_CONFIG.seo.ogImage;
  const canonicalUrl = canonical || BRAND_CONFIG.website;

  return (
    <Helmet>
      {/* Basic Meta */}
      <title>{siteTitle}</title>
      <meta name="description" content={siteDescription} />
      <meta name="keywords" content={siteKeywords} />
      <meta name="author" content={BRAND_CONFIG.seo.author} />
      
      {/* Canonical */}
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Robots */}
      {noIndex && <meta name="robots" content="noindex,nofollow" />}
      {!noIndex && <meta name="robots" content="index,follow" />}
      
      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={siteTitle} />
      <meta property="og:description" content={siteDescription} />
      <meta property="og:image" content={`${BRAND_CONFIG.website}${siteImage}`} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content={BRAND_CONFIG.fullName} />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content={BRAND_CONFIG.seo.twitterCard} />
      <meta name="twitter:title" content={siteTitle} />
      <meta name="twitter:description" content={siteDescription} />
      <meta name="twitter:image" content={`${BRAND_CONFIG.website}${siteImage}`} />
      
      {/* Additional Meta */}
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta charSet="utf-8" />
      <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
      
      {/* Theme */}
      <meta name="theme-color" content="#2563eb" />
      <meta name="msapplication-TileColor" content="#2563eb" />
    </Helmet>
  );
};
