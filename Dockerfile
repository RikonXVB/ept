# Используем официальный образ Bun
FROM oven/bun:1

# Создаем директорию приложения
WORKDIR /app

# Копируем файлы package.json и bun.lockb (если есть)
COPY package.json bun.lockb ./

# Устанавливаем зависимости
RUN bun install

# Копируем исходный код
COPY . .

# Открываем порт 3000
EXPOSE 3000

# Запускаем приложение
CMD ["bun", "run", "src/index.ts"]