# DNS Configuration for Vercel + asloguz.com

## 1. Vercel DNS Records (REQUIRED)

### Root Domain (asloguz.com)
```
Type: A
Name: @
Value: 76.76.21.21
TTL: 300
```

### WWW Subdomain
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 300
```

## 2. DELETE Old Records (IMPORTANT)

Remove these conflicting records:
- Any existing A records for @
- Any existing CNAME for www
- Any old hosting provider records

## 3. Verification Commands

```bash
# Check DNS propagation
dig asloguz.com A
dig www.asloguz.com CNAME

# Verify HTTPS
curl -I https://asloguz.com
curl -I https://www.asloguz.com
```

## 4. Vercel Domain Setup

1. Go to Vercel Dashboard → Project → Settings → Domains
2. Add: `asloguz.com`
3. Add: `www.asloguz.com`
4. Wait for DNS verification (5-30 min)
5. Configure redirects: www → non-www

## 5. Common Issues

- TTL too high (use 300)
- Old A records not deleted
- CNAME pointing to wrong provider
- DNS propagation delay
