FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Set environment to production
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Build the Next.js app
RUN npm run build

# Start the custom server, running db migration first
CMD npx drizzle-kit push && npx tsx server.ts
