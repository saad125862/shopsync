import secrets

from django.conf import settings
from django.http import HttpResponseBadRequest, HttpResponseRedirect
from django.views.decorators.http import require_GET

from . import shopify
from .models import Shop

STATE_SESSION_KEY = "shopify_oauth_state"


@require_GET
def install(request):
    """Shopify opens this with ?shop=&hmac=; we redirect to the consent screen."""
    shop = request.GET.get("shop", "")
    if not shopify.valid_shop(shop):
        return HttpResponseBadRequest("Invalid shop")
    if request.GET.get("hmac") and not shopify.verify_query_hmac(request.GET.dict()):
        return HttpResponseBadRequest("Bad HMAC")
    state = secrets.token_urlsafe(24)
    request.session[STATE_SESSION_KEY] = state
    return HttpResponseRedirect(shopify.authorize_url(shop, state))


@require_GET
def callback(request):
    params = request.GET.dict()
    shop_domain = params.get("shop", "")
    if not shopify.valid_shop(shop_domain):
        return HttpResponseBadRequest("Invalid shop")
    if not shopify.verify_query_hmac(params):
        return HttpResponseBadRequest("Bad HMAC")
    expected = request.session.pop(STATE_SESSION_KEY, None)
    if not expected or params.get("state") != expected:
        return HttpResponseBadRequest("Bad state")

    token_data = shopify.exchange_code(shop_domain, params.get("code", ""))
    shop, _ = Shop.objects.get_or_create(domain=shop_domain)
    shop.access_token = token_data["access_token"]
    shop.scope = token_data.get("scope", "")
    shop.is_active = True
    shop.uninstalled_at = None
    shop.save()

    # Post-install work (webhook registration + initial sync) is queued; added in Phase 2.
    from .tasks import post_install

    post_install.delay(shop.id)

    admin_url = f"https://{shop_domain}/admin/apps/{settings.SHOPIFY_API_KEY}"
    return HttpResponseRedirect(admin_url)
