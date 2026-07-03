FROM denoland/deno:2.7.13

WORKDIR /app

COPY . .

RUN deno cache Deno/server.ts
RUN mkdir -p \
  /app/storage/thesis \
  /app/storage/dissertation \
  /app/storage/confluence \
  /app/storage/synergy \
  /app/storage/hello \
  /app/storage/authors/profile-pictures \
  /app/storage/users/profile-picture \
  /app/Deno/logs

WORKDIR /app/Deno

EXPOSE 8000

CMD ["run", "--allow-net", "--allow-read", "--allow-write", "--allow-env", "server.ts"]
