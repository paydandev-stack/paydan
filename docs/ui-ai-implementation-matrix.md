# PAYDAN UI and AI implementation matrix

Updated: 26 November 2026

This matrix records the implemented scope of `PAYDAN_UI_AI_CONSOLIDATED_IMPLEMENTATION_PLAN_AND_PROMPT.md`. It is evidence for the current checkout, not a substitute for deployment checks.

| Requirement | Implementation evidence | Verification |
| --- | --- | --- |
| Remove Vercel AI Gateway | `src/server/assistant/providers.ts`, `src/server/assistant/config.ts`, dependency removal in `package.json` | Routing/config tests and production build |
| Route Groq, then OpenRouter, then deterministic fallback | `src/server/assistant/providers.ts`, `src/server/assistant.ts` | `tests/assistant-routing.test.ts` |
| Fail over only before output and only for provider availability failures | `src/server/assistant/config.ts`, `src/server/assistant.ts` | Routing classifier and fallback tests |
| Support catalogue search across every visible demo department | `src/data/products.ts`, `src/data/vendors.ts`, `src/server/test-buyer.ts` | Seeded catalogue coverage tests |
| Confirmation-safe add, remove, quantity and clear-cart proposals | `src/server/assistant/proposals.ts`, assistant proposal API routes and migration 009 | Commerce and mobile API tests |
| Render product results and proposal confirmation/cancellation states | `src/components/assistant/ask-paydan.tsx` | Component behavior plus responsive visual QA |
| Add reusable accessible password reveal control | `src/components/password-field.tsx`, `src/components/auth-form.tsx` | Typecheck, build and auth-page visual QA |
| Require matching password confirmation without sending it to Better Auth | `src/components/auth-form.tsx` | Browser validation and explicit registration payload inspection |
| Align Updates, Wishlist, Dashboard and Cart actions | `src/components/storefront/site-header.tsx`, `src/components/icons.tsx` | Responsive visual QA at compact desktop width |
| Improve compact desktop and mobile layout without redesigning the homepage | `src/styles/responsive.css`, `src/styles/storefront.css`, shared tokens | Responsive visual QA |
| Improve admin legibility and replace text glyph controls | `src/styles/admin-additions.css`, admin/vendor components and shared icons | Typecheck, build and targeted visual QA |
| Keep public and auth shells available during transient catalogue database outages | `src/server/public-catalog.ts`, `src/server/snapshot.ts` | Production build and disconnected public-page QA |
| Document production variables and rollout requirements | `.env.example`, `.env.docker.example`, `PRODUCTION_SERVICES.md`, `SETUP_AND_OPERATIONS.md` | Config checker and documentation review |

## Release boundary

Code, migrations and automated checks can be completed locally. A live-provider smoke test still requires valid Groq and/or OpenRouter credentials in the deployment environment, and deployment remains a separate authorized action.
