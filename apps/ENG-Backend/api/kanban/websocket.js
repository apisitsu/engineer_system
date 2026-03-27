/**
 * websocket.js
 * WebSocket layer for Kanban real-time updates using socket.io
 *
 * Channels:
 *   board:{boardId}  — users join when viewing a board, leave when switching
 *
 * Events emitted from server:
 *   cardCreate, cardUpdate, cardDelete
 *   listCreate, listUpdate, listDelete
 *   labelCreate, labelUpdate, labelDelete
 *   commentCreate, commentDelete
 */

function setupWebSocket(server) {
    const { Server } = require('socket.io');

    const io = new Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST', 'PATCH', 'DELETE'],
        },
        path: '/ws',
    });

    io.on('connection', (socket) => {
        console.log(`[WS] Client connected: ${socket.id}`);

        // Join a board room
        socket.on('board:join', (boardId) => {
            // Leave all previous board rooms
            socket.rooms.forEach(room => {
                if (room.startsWith('board:')) {
                    socket.leave(room);
                }
            });
            socket.join(`board:${boardId}`);
            console.log(`[WS] ${socket.id} joined board:${boardId}`);
        });

        // Leave a board room
        socket.on('board:leave', (boardId) => {
            socket.leave(`board:${boardId}`);
            console.log(`[WS] ${socket.id} left board:${boardId}`);
        });

        // Join user-specific room (for notifications)
        socket.on('user:join', (uCode) => {
            socket.join(`user:${uCode}`);
        });

        socket.on('disconnect', () => {
            console.log(`[WS] Client disconnected: ${socket.id}`);
        });
    });

    return io;
}

module.exports = { setupWebSocket };
