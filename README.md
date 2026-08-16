# RoutineAI Backend

NestJS modular monolith for RoutineAI (auth, tasks, deterministic predictions, OpenRouter AI, insights, notifications, subscriptions).

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `JWT_SECRET`, and optionally OpenRouter keys.
2. Install dependencies: `npm install`
3. Generate Prisma client: `npm run prisma:generate`
4. Apply migrations: `npm run prisma:migrate` (or `npm run prisma:deploy`)
5. Start: `npm run start:dev`

API base: `http://localhost:3000/api`  
Swagger: `http://localhost:3000/api/docs`

## Scripts

- `npm run build` — compile
- `npm test` — unit tests
- `npm run start:dev` — watch mode

## Postman

Import from `postman/`:

1. `RoutineAI.postman_collection.json`
2. `RoutineAI.postman_environment.json` (select **RoutineAI Local**)
3. Run **Auth → Register** or **Login** (saves `accessToken`)
4. Run **Tasks → Create Task** (saves `taskId`)
