import Deck from './src/deck.mjs';

import { createServer } from "http";
import { Server } from "socket.io";

import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
    host: "localhost",
    port: 5432,
    user: "postgres",
    password: "PASSWORD",
    database: "GodWord"
});
client.connect(async (err) => {
    if (err) throw err;
    console.log('PostgreSQL Connected... query: 2');
});

const http = createServer();
const io = new Server(http, {
    cors: {
        origin: ["http://localhost:8080"],
    },
});

const rooms = [];
const users = [];



io.on("connection", (socket) => {
    // 部屋を新しく建てる
    socket.on("create", (userName) => {
        if (userName == "") {
            io.to(socket.id).emit("notifyError", "名前を入力してください");
            return;
        }
        const roomId = generateRoomId();
        const user = { id: socket.id, name: userName, roomId };
        const server_deck = new Deck(1)
        const room = {
            id: roomId,
            users: [user],
            turnUserIndex: 0,
            posts: [],
            deck: server_deck,
            cards: [
                { userName: userName, card: [], index: [] },
            ],
        };
        rooms.push(room);
        users.push(user);
        socket.join(roomId);
        io.to(socket.id).emit("updateRoom", room);
    });

    // 部屋に入室する
    socket.on("enter", (userName, roomId) => {
        if (userName == "") {
            io.to(socket.id).emit("notifyError", "名前を入力してください");
            return;
        }
        const roomIndex = rooms.findIndex((r) => r.id == roomId);
        if (roomIndex == -1) {
            io.to(socket.id).emit("notifyError", "部屋が見つかりません");
            return;
        }
        const user = { id: socket.id, name: userName, roomId };
        rooms[roomIndex].users.push(user);
        rooms[roomIndex].cards.unshift({ userName: user.name, card: [] });
        users.push(user);
        socket.join(rooms[roomIndex].id);
        io.to(socket.id).emit("updateRoom", rooms[roomIndex]);
    });

    // しりとりの単語を送信
    socket.on("post", (input) => {
        const user = users.find((u) => u.id == socket.id);
        const roomIndex = rooms.findIndex((r) => r.id == user.roomId);
        const room = rooms[roomIndex];

        // ターンプレイヤーかチェック
        if (room.users[room.turnUserIndex].id != socket.id) {
            io.to(socket.id).emit("notifyError", "あなたのターンではありません");
            return;
        }
        // // 正しい入力かチェック
        // if (!checkWord(input, room.posts)) {
        //     io.to(socket.id).emit(
        //         "notifyError",
        //         "入力が不正です。1つ前の単語の最後の文字から始まる単語を半角英字入力してください"
        //     );
        //     return;
        // }
        // 単語を保存
        rooms[roomIndex].posts.unshift({
            userName: user.name,
            word: input,
            // isGameOver: checkGameOver(input),
        });
        // ターンプレイヤーを次のユーザーに進める
        rooms[roomIndex].turnUserIndex = getNextTurnUserIndex(room);

        io.in(room.id).emit("updateRoom", room);
    });

    //action
    socket.on("action", async (query, collect = null) => {
        // 送信したuser
        const user = users.find((u) => u.id == socket.id);
        // ルームのインデックス
        const roomIndex = rooms.findIndex((r) => r.id == user.roomId);
        const room = rooms[roomIndex];
        // ターンプレイヤーかチェック
        if (room.users[room.turnUserIndex].id != socket.id) {
            io.to(socket.id).emit("notifyError", "あなたのターンではありません");
            return;
        }

        //action
        //ドロー
        if (query === 0) {
            // 既存の連想配列を検索してuserNameが一致するcardを探す
            const targetCardIndex = rooms[roomIndex].cards.findIndex((c) => c.userName === user.name);

            if (targetCardIndex !== -1) {
                // 該当するカードが見つかった場合、そのカードにdraw_cardを追加
                rooms[roomIndex].cards[targetCardIndex].card = rooms[roomIndex].cards[targetCardIndex].card.concat(rooms[roomIndex].deck.getCard(3));
                const indexArray = [];
                for (var i = 0; i <= rooms[roomIndex].cards[targetCardIndex].card.length; i++) {
                    indexArray.push(i);
                }
                rooms[roomIndex].cards[targetCardIndex].index = indexArray
            } else {
                // 該当するカードが見つからなかった場合、新しいカードとして連想配列に追加
                rooms[roomIndex].cards.unshift({
                    userName: user.name,
                    card: rooms[roomIndex].deck.getCard(3),
                    index: [1, 2, 3],
                });
            }
            //sort cards
            rooms[roomIndex].cards[targetCardIndex].card.sort();
        }
        //2倍
        else if (query === 1) {

        }
        //提出
        else if (query === 2) {
            try {
                const query_1 = `select * from godwordtable where title = '${collect}';`;
                const result_1 = await client.query(query_1);

                if (result_1.rows[0]) {
                    console.log("データが存在します。");
                } else {
                    console.log("データは存在しません。");
                    io.to(socket.id).emit("notifyError", "データは存在しません");
                    return
                }
            } catch (err) {
                console.error('Error querying database:', err);
                return
            }
        }
        //例外処理
        else {
            return
        }

        // console.log(draw_card);
        console.log(room);
        // console.log(rooms[roomIndex]);
        // console.log("cards:", rooms[roomIndex].cards);
        console.log(rooms[roomIndex].deck.cards);
        // console.log(rooms[roomIndex].deck.getCard(3));

        // ターンプレイヤーを次のユーザーに進める
        rooms[roomIndex].turnUserIndex = getNextTurnUserIndex(room);

        io.in(room.id).emit("updateRoom", room);
        io.to(socket.id).emit("notifyError", "正解");

    });


    // 最初から始める
    socket.on("restart", () => {
        const user = users.find((u) => u.id == socket.id);
        const roomIndex = rooms.findIndex((r) => r.id == user.roomId);
        const room = rooms[roomIndex];
        rooms[roomIndex].posts.length = 0;
        rooms[roomIndex].isGameOver = false;

        io.in(room.id).emit("updateRoom", room);
    });

    //強制終了ボタン
    socket.on("exit", () => {
        const user = users.find((u) => u.id == socket.id);
        const roomIndex = rooms.findIndex((r) => r.id == user.roomId);
        const room = rooms[roomIndex];
        // console.log(rooms[roomIndex]);
        rooms[roomIndex].isGameOver = true;
        // console.log(rooms[roomIndex]);
        io.in(room.id).emit("updateRoom", room);
    })
    // 接続が切れた場合
    socket.on("disconnect", () => {
        const user = users.find((u) => u.id == socket.id);
        if (!user) {
            // userデータがないときは未入室なので何もせず終了
            return;
        }
        const roomIndex = rooms.findIndex((r) => r.id == user.roomId);
        if (roomIndex === -1) {
            // roomが見つからない場合も何もせず終了
            return;
        }
        const room = rooms[roomIndex];
        if (room.users.length === 1) {
            // userデータがないときは未入室なので何もせず終了
            return;
        }
        const userIndex = room.users.findIndex((u) => u.id == socket.id);
        if (userIndex === -1) {
            return;
        }
        // ターンプレイヤーの場合、次のユーザーに進める
        if (userIndex == room.turnUserIndex) {
            rooms[roomIndex].turnUserIndex = getNextTurnUserIndex(room);
        }
        // ユーザーのデータを削除
        rooms[roomIndex].users.splice(userIndex, 1);
        users.splice(
            users.findIndex((u) => u.id == socket.id),
            1
        );
        // ターンプレイヤーのindexが1ズレないように補正
        if (room.turnUserIndex > userIndex) {
            rooms[roomIndex].turnUserIndex--;
        }
        io.in(room.id).emit(
            "notifyDisconnection",
            user.name,
            room.users[rooms[roomIndex].turnUserIndex].name
        );
    });
});

// ランダムなroomId(1000~9999)を生成する
function generateRoomId() {
    const id = Math.floor(Math.random() * 8999 + 1000);
    if (rooms.some((r) => r.id == id)) {
        // ランダムに生成したidが既に存在する場合は作り直す
        return generateRoomId();
    }
    return id;
}

// 入力が不正な値でないかチェック
function checkWord(word, posts) {
    // 半角英字でないならNG
    if (!word.match(/^[a-z]+$/)) {
        return false;
    }
    // 1つ目の単語の場合特にチェックなしでOK
    if (posts.length == 0) {
        return true;
    }
    // 前の単語の最後の文字から始まってるならOK
    return word.slice(0, 1) == posts[0].word.slice(-1);
}

// 終了(xで終わる単語を入力したかどうか)判定
function checkGameOver(word) {
    return word.slice(-1) == "x";
}

// 次のターンプレイヤーのindexを返却
function getNextTurnUserIndex(room) {
    return room.turnUserIndex == room.users.length - 1
        ? 0
        : room.turnUserIndex + 1;
}

http.listen(3031);
