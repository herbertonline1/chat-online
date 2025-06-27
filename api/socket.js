const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

// Função exportada para a Vercel (serverless)
module.exports = (req, res) => {
  // Criação do aplicativo Express e do servidor HTTP
  const app = express();
  const server = http.createServer(app);
  const io = socketIo(server);

  const players = [];
  let currentQuiz = null;

  app.use(express.static('public'));

  // Lógica do WebSocket
  io.on('connection', socket => {
    console.log('Usuário conectado:', socket.id);

    socket.on('join', ({ name, character, avatar }) => {
      const x = Math.floor(Math.random() * 460) + 20;
      const y = Math.floor(Math.random() * 260) + 20;

      players.push({
        id: socket.id,
        name,
        character,
        avatar,
        x,
        y,
        points: 0,
        medals: [],
        quizWins: 0
      });
      io.emit('playersUpdate', players);
      if (currentQuiz && currentQuiz.active) {
        socket.emit('quizStarted', { question: currentQuiz.question });
      }
    });

    socket.on('chat', msg => {
      const player = players.find(p => p.id === socket.id);
      if (!player) return;

      if (currentQuiz && currentQuiz.active) {
        if (msg.trim().toLowerCase() === currentQuiz.answer.toLowerCase()) {
          currentQuiz.active = false;
          player.points += 10;
          player.quizWins += 1;
          if (!player.medals.includes('🏅')) player.medals.push('🏅');

          io.emit('chat', {
            id: 'system',
            message: `Quiz encerrado! ${player.name} acertou e ganhou 10 pontos!`
          });
          io.emit('playersUpdate', players);
          io.emit('quizEnded');
          return;
        }
      }

      player.points += 1;
      io.emit('chat', { id: socket.id, message: msg });
      io.emit('playersUpdate', players);
    });

    socket.on('moveTo', ({ x, y }) => {
      const player = players.find(p => p.id === socket.id);
      if (!player) return;
      player.x = Math.max(0, Math.min(540, x));
      player.y = Math.max(0, Math.min(340, y));
      io.emit('playersUpdate', players);
    });

    socket.on('changeBackground', url => {
      const player = players.find(p => p.id === socket.id);
      if (player && typeof url === 'string' && url.startsWith('http')) {
        player.points += 5;
        io.emit('playersUpdate', players);
        io.emit('updateBackground', url);
      }
    });

    socket.on('emojiUsed', () => {
      const player = players.find(p => p.id === socket.id);
      if (player) {
        player.points += 2;
        io.emit('playersUpdate', players);
      }
    });

    socket.on('startQuiz', ({ question, answer }) => {
      if (currentQuiz && currentQuiz.active) {
        socket.emit('chat', { id: 'system', message: 'Já existe um quiz ativo!' });
        return;
      }
      currentQuiz = { question, answer, active: true };
      io.emit('quizStarted', { question });
      io.emit('chat', { id: 'system', message: `Quiz iniciado: ${question}` });
    });

    socket.on('disconnect', () => {
      const i = players.findIndex(p => p.id === socket.id);
      if (i !== -1) {
        players.splice(i, 1);
        io.emit('playersUpdate', players);
      }
    });
  });

  // Enviar uma resposta HTTP básica para o Vercel
  res.status(200).send("Função serverless rodando!");
};
