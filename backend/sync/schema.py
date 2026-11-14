from drf_spectacular.extensions import OpenApiAuthenticationExtension


class SessionTokenScheme(OpenApiAuthenticationExtension):
    target_class = "sync.auth.SessionTokenAuthentication"
    name = "shopifySessionToken"

    def get_security_definition(self, auto_schema):
        return {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Shopify App Bridge session token, or a 30-day mobile link code.",
        }
