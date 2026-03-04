# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 5.4.x   | ✅        |
| < 5.0   | ❌        |

## Reporting a Vulnerability

If you find a security vulnerability, please report it via GitHub Security Advisories:

1. Go to the repository
2. Click "Security" tab
3. Click "Report a vulnerability"

## Security Best Practices

### API Keys
- Never commit API keys to the repository
- Use environment variables or `.env` files
- Rotate keys periodically

### Docker
- Always pull images from official registry
- Verify image signatures
- Run with read-only filesystem when possible

### Local Models
- Using Ollama keeps data local
- Ideal for sensitive workloads

## Dependency Security

We run `npm audit` on every CI build and address high/critical vulnerabilities within 48 hours.
