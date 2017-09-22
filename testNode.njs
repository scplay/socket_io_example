var express = require("express"),
        app = express(),
        http = require("http"),
        server = http.createServer(app),
        soio = require("socket.io"),
        io = soio.listen(server),
        port = 8077;

var onlineList = {},
        tempContent =  [];


console.log("Now Starting http .. | port:" + port);
