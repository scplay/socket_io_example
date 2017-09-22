var express = require("express"),
    app = express(),
    http = require("http"),
    server = http.createServer(app),
    soio = require("socket.io"),
    io = soio.listen(server),
    port = 8077;

var onlineList = {},
    tempContent = [];


var CUSTOMER_ROOM_PREFIX = 'CUSTOMER_ID:';

app.use("/", express.static(__dirname + "/www/"));

app.get('/pushorder', pushOrderListener);

// io.sockets 是默认的 namespace 可简写成 io
// 任何namespace在有 client 连接时都会触发 connnection 事件
io.on("connection", function(socket) {

    console.log('new client: ' + socket.id + ' connected root channel!');

    // console.log(Object.keys(socket));

    connectionListener(socket);

    broadcastToEveryOneButConnectedClient(socket);

    socket.on("new-data-on-client", clientNewDataListener.bind(null, socket));
    //     socket.on("new-login", newLoginListener);
    //     socket.on('disconnect', disconnetListener);
    listenRoomJoin(socket);

});

// io 可以区分 namespace 其实就是路由 , 然而 on 方法都不触发为什么呢？
// var order_channel = io.of('order');

// order_channel.on('connnect', function(socket) {

//     console.log('new client: ' + socket.id + ' connected order channel!');

//     connectionListener(socket, '您已进入订单频道');
// });

// namespace on method not working ?? why
// order_channel.on("new-data-on-client", clientNewDataListener.bind(null, order_channel));


// setInterval(function() {
//     order_channel.emit("login-succeed", 'order!');
// }, 1000)

server.listen(port);

console.log("Now Starting http .. | port:" + port);


/**
 * 
 * @param socket 
 */
function broadcastToEveryOneButConnectedClient(socket) {
    // 下面这两个是一样的，只有不是当前连接的其它clients 才能收到？
    io.sockets.emit("broadcast", 'data from server to every one');

    // socket.broadcast.emit("broadcast", 'data from server');
}
/**
 * client connected 
 * 
 * @param socket 
 */
function connectionListener(socket, data) {
    socket.emit("login-succeed", {
        recieved: data || "连接成功"
    });
}

/**
 * new client data recieved
 * @param data 
 */
function clientNewDataListener(socket, data) {

    console.log(data);

}

/**
 * new client login
 * 
 * @param data 
 */
function newLoginListener(data) {
    // console.log(data);
    socket.broadcast.emit("new-login", {
        recieved: data
    });

    socket.emit("temp-Data", {
        recieved: tempContent
    });

    //  在线用户？
    onlineList[socket.conn.id] = data.uid;

}

/**
 * new order notification, broadcast new msg
 * 
 * @example http://localhost:8077/pushorder?token=xjxx&order_id=1
 * 
 * @param req 
 * @param res 
 */
function pushOrderListener(req, res) {
    if (req.query.token != 'xjxx') {
        return res.send('token mismatch');
    }

    var order_id = req.query.order_id;

    res.send('trigger push!');

    var room = CUSTOMER_ROOM_PREFIX + req.query.customer_id;

    // to 或 in 都可以
    io.to(room).emit('new-order-on-server', {
        order_id: order_id
    });
}

/**
 * disconnect
 * 
 * @param socket 
 */
function disconnetListener(socket) {
    var logUid = onlineList[socket.conn.id];
    // console.log(logUid);
    if (logUid) {
        socket.broadcast.emit("some-logut", {
            recieved: logUid
        });
    }
    delete onlineList[socket.conn.id];
}

function tempStore(data) {
    // 只保存10个近期信息
    tempContent.push(data);
    tempContent.length > 5 ? tempContent.shift() : void 0;
    // console.log(tempContent);
};

/**
 * room 的加入与 leave 是在服务器端的
 * @param socket 
 */
function listenRoomJoin(socket) {
    socket.on('client.join-room', function(data) {
        console.log(data);
        socket.join(CUSTOMER_ROOM_PREFIX + data.customer_id);
    })
}