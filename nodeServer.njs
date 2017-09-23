var express = require("express"),
    app = express(),
    http = require("http"),
    server = http.createServer(app),
    // server = http.Server(app),
    soio = require("socket.io"),
    io = soio.listen(server),
    // io = soio(server),
    port = 8077;

var onlineList = {},
    onlineIDs = [],
    tempContent = [];

var CUSTOMER_ROOM_PREFIX = 'CUSTOMER_ID:';

// wildcard middleware
var middleware = require('socketio-wildcard')();

io.use(middleware);

app.use("/", express.static(__dirname + "/www/"));

app.get('/pushorder', pushOrderListener);

// io.sockets 是默认的 namespace 可简写成 io
// 任何namespace在有 client 连接时都会触发 connnection 事件
io.on("connection", rootNameSpaceConnectionListener);

// io 可以区分 namespace  
// 然而 on 方法都不会触发
// 好像 namespace 只能 emit 信息 ， on 只有两个 connection 和 disconnect
var order_channel = io.of('/order');

order_channel.on('connection', orderNameSpaceConnectionListener);

server.listen(port);

console.log("Now Starting http .. | port:" + port);


// ---------------- Listeners ----------------------

function rootNameSpaceConnectionListener(socket) {

    console.log('new client: ' + socket.id + ' connected root channel!');

    onlineIDs.push(socket.id);

    connectionListener(socket);

    broadcastToEveryOneButConnectedClient(socket);

    clientNewDataListener(socket);
    
    listenRoomJoin(socket);

    sayToSomeOneListener(socket);

    disconnectListener(socket);    

    wildcardListener(socket);

}

function orderNameSpaceConnectionListener(socket) {

    console.log('new client: ' + socket.id + ' connected order channel!');

    socket.join(CUSTOMER_ROOM_PREFIX + 1);

    socket.on("disconnect", ()=>console.log('order disconnect'));

    connectionListener(socket, '您已进入订单频道');
}

/**
 * 
 * @param socket 
 */
function broadcastToEveryOneButConnectedClient(socket) {
    // 下面这两个是一样的，只有不是当前连接的其它clients 才能收到？
    // 这个包括 任何 namespace 都会收到
    // 如果在 connection 中广播，正在连接的这个 client 是不会收到这条信息的
    io.sockets.emit("broadcast", 'data from server to every one but client');

    // 刷新 IDS
    broadcastRefreshOnlineIds(socket);
    // 如果等一下广播（不是下一帧，连接上的时间也不一定，超过800ms就差不多了）所有人都会收到
    // setTimeout(()=>io.sockets.emit("broadcast", 'data from server to every one'), 
    //     800);
}

/*
 *
 */
function broadcastRefreshOnlineIds(socket){
    // 这个无法广播给自己
    // socket.broadcast.emit("broadcast.refresh-online-ids", onlineIDs);

    // 这个可以广播给所有人
    io.emit("broadcast.refresh-online-ids", onlineIDs);

    console.log(onlineIDs.length + ' people remain');
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
function clientNewDataListener(socket) {
    socket.on("new-data-on-client", function(data) {
        console.log(data);
    });
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

    // to 或 in 都可以指定对应的 room
    io.to(room).emit('new-order-on-server', {
        order_id: order_id
    });

    // 直接给 这个 namespace 的发送信息也可以
    io.of('/order').emit('new-order-on-server', {
        order_id: order_id
    });

    // 发给这个 namespace 中的指定 房间 的发送信息也可以
    io.of('/order').to(room).emit('new-order-on-server', {
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

/**
 * 缓存消息
 */
function cacheMsg(data) {
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

/** 
 * 处理下线的人
 */
function disconnectListener(socket) {
    socket.on('disconnect', function(){
        console.log('socket id:' + socket.id + ' leave socket io');
        
        onlineIDs = onlineIDs.filter(v => v !== socket.id);

        broadcastRefreshOnlineIds(socket);
    });

}

/**
 * listen on all events only on root(/) namespace
 */
function wildcardListener(socket) {
    socket.on("*", ()=>console.log('wildcard matched!'));
}

/**
 * 发给指定的client
 * @param socket 
 */
function sayToSomeOneListener(socket) {
    socket.on('client.say-to-someone', function(data) {
        // 下面这3个是一样的
        socket.broadcast.to(data.id).emit('new-order-on-server',
         'socket broadcast: '+ data.msg);
        
        // io.to(data.id).emit('new-order-on-server', 
        //  'io broadcast: '+ data.msg);

        // io.sockets.to(data.id).emit('new-order-on-server',
        //  'io sockets broadcast: '+  data.msg);

        // 这3个是一样的
        // setTimeout(()=> {
        //     return;
        //     // socket.broadcast.to 不会广播给自己，但是 io 就会
        //     io.to('CUSTOMER_ID:1').emit('new-order-on-server',
        //  'room broadcast: '+ data.msg);
        // },3000);
    })
}