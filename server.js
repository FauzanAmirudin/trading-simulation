const { createServer } = require("http");
const { Server } = require("socket.io");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);
  const io = new Server(httpServer, {
    cors: {
      origin: dev ? "http://localhost:3000" : "https://yourdomain.com",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Listen for stock price updates from server
    socket.on("join-stock", (stockSymbol) => {
      socket.join(`stock:${stockSymbol}`);
      console.log(`${socket.id} joined stock:${stockSymbol}`);
    });

    socket.on("leave-stock", (stockSymbol) => {
      socket.leave(`stock:${stockSymbol}`);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
