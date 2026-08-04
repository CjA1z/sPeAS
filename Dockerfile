FROM node:24-alpine AS ui-builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
COPY experience-studio ./experience-studio
COPY app-ui ./app-ui
COPY shared ./shared
COPY Deno/shared ./Deno/shared

RUN npm run check:experience
RUN npm run build:experience
RUN npm run check:app-ui
RUN npm run build:app-ui

FROM denoland/deno:2.7.13

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends poppler-utils tesseract-ocr tesseract-ocr-eng tesseract-ocr-fil webp ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY . .
COPY --from=ui-builder /app/Deno/admin/experience-studio ./Deno/admin/experience-studio
COPY --from=ui-builder /app/Deno/admin/react-ui ./Deno/admin/react-ui
COPY --from=ui-builder /app/Deno/Public/react-ui ./Deno/Public/react-ui

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

CMD ["run", "--allow-net", "--allow-read", "--allow-write", "--allow-env", "--allow-run=pdftoppm,pdfinfo,cwebp,ffmpeg,ffprobe,clamdscan", "server.ts"]
