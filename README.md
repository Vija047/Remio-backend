# RoutineAI Backend

NestJS modular monolith for RoutineAI (auth, tasks, deterministic predictions, OpenRouter AI, insights, notifications, subscriptions).

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `JWT_SECRET`, Stripe keys, and optionally OpenRouter keys.
2. Install dependencies: `npm install`
3. Generate Prisma client: `npm run prisma:generate`
4. Apply migrations: `npm run prisma:migrate` (or `npm run prisma:deploy`)
5. Start server: `npm run start:dev`

API base: `http://localhost:3000/api`  
Swagger: `http://localhost:3000/api/docs`

## Scripts

- `npm run build` — compile
- `npm test` — unit tests
- `npm run start:dev` — watch mode

---

## Stripe Subscription Billing & Webhook Test Mode Setup

RoutineAI uses Stripe test mode keys for checkout, customer portal, and subscription lifecycle management.

### 1. Environment Configuration

Add your Stripe Test Mode keys and Price IDs to `backend/.env`:

```env
# Stripe Test Secret Key & Webhook Secret
STRIPE_SECRET_KEY=sk_test_51...
STRIPE_WEBHOOK_SECRET=whsec_...

# Product Tiers (Monthly & Annual Price IDs from Stripe Dashboard)
STRIPE_PRICE_PRO_MONTHLY=price_1ProMonthlyId...
STRIPE_PRICE_PRO_YEARLY=price_1ProYearlyId...
STRIPE_PRICE_PRO_FAMILY_MONTHLY=price_1ProFamilyMonthlyId...
STRIPE_PRICE_PRO_FAMILY_YEARLY=price_1ProFamilyYearlyId...

APP_URL=http://localhost:3000
```

> **Security Note**: Never commit live API keys. Secret keys are loaded strictly from environment variables and are omitted from client-side bundles.

### 2. Local Webhook Forwarding with Stripe CLI

To test webhooks locally during development, run the Stripe CLI forwarder:

```bash
# Authenticate Stripe CLI
stripe login

# Forward webhook events to local NestJS backend
stripe listen --forward-to http://localhost:3000/api/subscription/webhook
```

Copy the printed webhook signing secret (`whsec_...`) into your `STRIPE_WEBHOOK_SECRET` variable in `.env`.

### 3. Required Manual Test Scenarios

Run the following manual test scenarios before deploying to production:

#### Scenario A: Successful Payment & Checkout Completion
1. Open the mobile app and navigate to **Settings -> RoutineAI Pro**.
2. Select **Pro** or **Pro + Family** plan and tap **Subscribe**.
3. Complete checkout using Stripe's standard test card: `4242 4242 4242 4242` (Expiration: any future date, CVC: `123`).
4. Verify the `checkout.session.completed` event is received by local webhook listener.
5. Verify `subscription_status` is updated to `active` and features (Unlimited Routines, Insights, Family Sharing) are unlocked.

#### Scenario B: Declined Card Handling
1. Initiate Stripe Checkout Session from app.
2. Enter Stripe test card for declined payments: `4000 0000 0000 0002` (Your card was declined).
3. Confirm Checkout prevents completion and does not emit a successful subscription event.
4. Verify user remains on `free` plan server-side.

#### Scenario C: Subscription Cancellation via Customer Portal
1. Navigate to **Profile -> Manage Subscription (Stripe Portal)**.
2. In the hosted Stripe Customer Portal, select **Cancel Subscription**.
3. Verify `customer.subscription.deleted` webhook event is processed by `POST /api/subscription/webhook`.
4. Confirm `subscription_status` updates to `canceled` and user reverts to `free` tier.

#### Scenario D: Failed Renewal & Dunning
1. Simulate a failed recurring invoice payment using Stripe CLI:
   ```bash
   stripe trigger invoice.payment_failed
   ```
2. Verify `invoice.payment_failed` event updates `subscription_status` to `past_due` in the database.
3. Confirm server-side feature gates prevent access to Pro-only endpoints (Insights, priority notifications, creation of >5 routines) while in past due/canceled status.

---

## Postman Collection

Import from `postman/`:

1. `RoutineAI.postman_collection.json`
2. `RoutineAI.postman_environment.json` (select **RoutineAI Local**)
3. Run **Auth -> Register** or **Login** (saves `accessToken`)
4. Run **Subscription -> Get Config** and **Subscription -> Checkout Session**
