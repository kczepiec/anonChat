const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

const connections = new Map();
const tracker = new Array();

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(`${__dirname}/index.html`);
});

app.get('/chat', (req, res) => {
    res.sendFile(`${__dirname}/chat.html`);
});


let currentUser = null;
let randomUser = null;

Array.prototype.getRandom = function(last) {
    if (this.length <= 1) {
        return;
    } else {
        var num = 0;
        do {
            num = Math.floor(Math.random() * this.length);
        } while (this[num][0] == last || this[num][1]);
        return this[num][0];
    }
}

function getCountOfFreeUser(arr) {
    let count = 0;
    for (let i = 0; i < arr.length; i++) {
        if (!arr[i][1]) {
            count++;
        }
    }
    return count;
}



io.on('connection', function(socket) {
    let currentUser = socket.id;

    // key: socket.id, value: { busy ? }
    connections.set(currentUser, false);
    io.emit('a user join', connections.size);

    socket.on('get random', function() {
        var unqArr = Array.from(connections);
        if (unqArr.length <= 1) {
            socket.emit('unexpected', "Przepraszamy, niestety nie ma z kim przeprowadzić rozmowy!");
        } else if (getCountOfFreeUser(unqArr) < 2) {
            socket.emit('unexpected', "Zaproś znajomych do wspólnej rozmowy");
        } else {
            randomUser = unqArr.getRandom(currentUser);

            if (randomUser != undefined) {
                connections.set(randomUser, true);
                connections.set(currentUser, true);
                tracker.push({
                    mem1: randomUser,
                    mem2: currentUser
                });

                socket.emit('assign-random', randomUser);
                io.to(randomUser).emit('got one', currentUser);

            } else {
                socket.emit('unexpected', "Nikogo nie znaleziono");
            }
        }
    });

    socket.on('typing start', function (to) {
      io.to(to).emit('stranger typing start');
    });


    socket.on('private chat', function(data) {
        io.to(data.to).emit('stranger typing stop');
        io.to(data.to).emit('message append', data.message);
    });

    socket.on('remove', function(data) {
        connections.set(data.from, false);
        connections.set(data.to, false);

        let chatterIndex = tracker.findIndex((item) =>{
          if(item.mem1 == data.from || item.mem2 == data.from) {
            return true;
          }
        });

        tracker.splice(chatterIndex, 1);

        io.to(data.to).emit('stranger disconnect');

    });

    socket.on('disconnect', function() {
        if (connections.has(currentUser)) {

            connections.delete(currentUser);

            if (tracker.length > 0) {
                let chatterIndex = tracker.findIndex((item) => {
                    if (item.mem1 == currentUser ||
                        item.mem2 == currentUser
                    ) {
                        return true;
                    }
                });


                if (chatterIndex != undefined) {
                    let chatter = tracker[chatterIndex];
                    // that person was chatting too

                    io.to(chatter.mem1).emit('stranger leave');
                    io.to(chatter.mem2).emit('stranger leave');
                    if (connections.has(chatter.mem1)) {
                      connections.delete(chatter.mem1);
                    }
                    if (connections.has(chatter.mem2)) {
                      connections.delete(chatter.mem2);
                    }
                    tracker.splice(chatterIndex, 1);
                }

            }
        }
        io.emit('a user leave', connections.size);
    });
});


app.get('/getAll', function(req, res) {
    res.json(Array.from(connections));
});

app.get('/room', function (req, res) {
  res.json(tracker);
});


server.listen(process.env.PORT || 3000);
