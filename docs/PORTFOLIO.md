# Portfolio copy for ShopSync

Only claim what is built. Items marked (after deploy) should wait until the live deployment works.

## Project card

**ShopSync: Shopify inventory and order sync**
Django, Django REST Framework, Celery, PostgreSQL, Redis, React, TypeScript, React Native, Shopify Admin GraphQL API, Docker

Highlights
- Shopify OAuth install and embedded app with session-token auth
- HMAC-verified, idempotent webhooks with queued processing, retries and replay
- GraphQL sync and nightly reconcile that repairs inventory drift
- Low-stock alerts by email and push; two-way stock changes with one-tap undo
- Shopify-admin-style React dashboard and a React Native companion app
- 76 automated tests across backend, web and mobile; CI on every push

Links: GitHub https://github.com/saad125862/shopsync · Live demo (after deploy) · Demo video (after recording)

## Skills section changes

- Backend, web and mobile: add Django, Django REST Framework, Celery, React Native, Expo
- New group "E-commerce": Shopify apps, Admin GraphQL API, webhooks, App Bridge, Polaris
- DevOps and testing: add pytest, Redis, GitHub Actions, Vitest

## Hero line

"I build full-stack products: Python/Django, React, React Native, and Shopify integrations."

## Stats

Projects delivered: 24 → 25 (after deploy).

## Interview talking points

- Why webhooks are acknowledged fast and processed in Celery, and how idempotency uses the webhook id
- Why the nightly reconcile exists (webhooks can be missed) and how it counts drift
- How the embedded app authenticates (App Bridge session token verified with the app secret)
- Why tokens are encrypted at rest and link codes are signed, expiring, and cannot mint more codes
- Trade-offs: Render free-tier cold starts versus Shopify's webhook timeout
