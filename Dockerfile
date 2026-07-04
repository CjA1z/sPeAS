FROM node:24-alpine AS experience-builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY experience-studio ./experience-studio
COPY Deno/shared ./Deno/shared

RUN npm ci
RUN npm run check:experience
RUN npm run build:experience

FROM denoland/deno:2.7.13

WORKDIR /app

COPY . .
COPY --from=experience-builder /app/Deno/admin/experience-studio ./Deno/admin/experience-studio

RUN deno cache Deno/server.ts
RUN mkdir -p \
  /app/storage/thesis \
  /app/storage/dissertation \
  /app/storage/confluence \
  /app/storage/synergy \
  /app/storage/hello \
  /app/storage/site-branding \
  /app/storage/authors/profile-pictures \
  /app/storage/users/profile-picture \
  /app/Deno/logs

WORKDIR /app/Deno

EXPOSE 8000

CMD ["run", "--allow-net", "--allow-read", "--allow-write", "--allow-env", "server.ts"]
