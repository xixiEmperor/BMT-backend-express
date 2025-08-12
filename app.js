import express from "express";
import { createServer } from 'http'
import cors from 'cors'
import dotenv from 'dotenv'
import { Server } from 'socket.io'

dotenv.config()

const PORT = process.env.PORT

const app = express()

app.use(express.json())
app.use(cors())

const server = createServer(app)

const io = new Server(server, { cors: { origin: '*' } })

io.on('connection', (socket) => {
    console.log(`id为${socket.id}的实例已连接`)

    socket.on('message', (m) => {
        console.log('前端说:', m)
        socket.emit('echo', '我听到你说话了')
    })
})

server.listen(PORT, () => {
    console.log(`后端程序正在http://localhost:${PORT}上运行`)
})