//    ______              __ _       __                      __
//   / ____/  ____   ____/ /| |     / /  ____    _____  ____/ /
//  / / __   / __ \ / __  / | | /| / /  / __ \  / ___/ / __  /
// / /_/ /  / /_/ // /_/ /  | |/ |/ /  / /_/ / / /    / /_/ /
// \____/   \____/ \__,_/   |__/|__/   \____/ /_/     \__,_/

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

const TURN = 15;
const ROUND = 3;

const EXODIA = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

const ROBofTIME = 3;

io.on("connection", (socket) => {
    // 部屋を新しく建てる
    socket.on("create", (userName) => {
        if (userName == "") {
            io.to(socket.id).emit("notifyError", "名前を入力してください");
            return;
        }
        const roomId = generateRoomId();
        const user = { id: socket.id, name: userName, roomId };
        const room = {
            id: roomId,
            users: [user],
            turn: 0,
            round: 0,
            turnUserIndex: 0,
            posts: [],
            deck: new Deck(1),
            cards: [
                { userName: userName, card: [], num: 0 },
            ],
            points: [
                { userName: userName, point: 0 }
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
        const room = rooms[roomIndex];
        const user = { id: socket.id, name: userName, roomId };
        rooms[roomIndex].users.push(user);
        rooms[roomIndex].cards.unshift({ userName: user.name, card: [], num: 0 });
        rooms[roomIndex].points.unshift({ userName: user.name, point: 0 });
        users.push(user);
        socket.join(rooms[roomIndex].id);
        // io.to(socket.id).emit("updateRoom", rooms[roomIndex]);
        io.in(room.id).emit("updateRoom", room);
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

        //roomの更新
        io.in(room.id).emit("updateRoom", room);
    });

    //action
    //ドロー
    socket.on('action_draw', () => {
        var exodia_flg = false;
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
        // 既存の連想配列を検索してuserNameが一致するcardを探す
        const targetCardIndex = rooms[roomIndex].cards.findIndex((c) => c.userName === user.name);

        // 該当するカードが見つかった場合、そのカードにdraw_cardを追加
        rooms[roomIndex].cards[targetCardIndex].card = rooms[roomIndex].cards[targetCardIndex].card.concat(rooms[roomIndex].deck.getCard(3));
        //カードの枚数を更新
        rooms[roomIndex].cards[targetCardIndex].num = rooms[roomIndex].cards[targetCardIndex].card.length;

        //EXODIA
        if (EXODIA.every(card => rooms[roomIndex].cards[targetCardIndex].card.includes(card))) {
            console.log('EXODIA');
            exodia_flg = true;
            //point加算
            rooms[roomIndex].points[targetCardIndex].point = rooms[roomIndex].points[targetCardIndex].point + 100;
            //turn 終了
            rooms[roomIndex].turn = TURN;
        }

        //sort cards
        rooms[roomIndex].cards[targetCardIndex].card.sort();

        // ターンプレイヤーを次のユーザーに進める
        rooms[roomIndex].turnUserIndex = getNextTurnUserIndex(room);

        //ターンとラウンドの管理
        if (rooms[roomIndex].turn < TURN) {
            //turnを進める
            rooms[roomIndex].turn = rooms[roomIndex].turn + 1;
        } else {
            //turnの初期化
            rooms[roomIndex].turn = 0;
            //roundの管理
            if (rooms[roomIndex].round < ROUND) {
                //roundを進める
                rooms[roomIndex].round = rooms[roomIndex].round + 1;

                //デッキの初期化
                rooms[roomIndex].deck = new Deck(1);

                //手札の初期化
                for (var i = 0; i < rooms[roomIndex].cards.length; i++) {
                    rooms[roomIndex].cards[i].card = [];
                    rooms[roomIndex].cards[i].num = 0;
                }
            } else {
                //gameの終了
                rooms[roomIndex].isGameOver = true;
            }
        }

        //roomの更新
        io.in(room.id).emit("updateRoom", room);

        if (exodia_flg) {
            io.to(socket.id).emit("notifyError", "EXODIA");
        }
    });

    socket.on('action_double', (double_text) => {
        //inputの長さのチェック 1文字以上 1文字以下だったら return
        if (double_text.length !== 1) {
            io.to(socket.id).emit("notifyError", "2倍にできるのは1文字のみです");
            return
        }
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
        // 既存の連想配列を検索してuserNameが一致するcardを探す
        const targetCardIndex = rooms[roomIndex].cards.findIndex((c) => c.userName === user.name);

        // 該当するカードが見つかった場合、そのカードにdouble_textを追加
        rooms[roomIndex].cards[targetCardIndex].card.push(double_text);

        //sort cards
        rooms[roomIndex].cards[targetCardIndex].card.sort();

        // ターンプレイヤーを次のユーザーに進める
        rooms[roomIndex].turnUserIndex = getNextTurnUserIndex(room);

        //turnを進める
        rooms[roomIndex].turn = rooms[roomIndex].turn + 1;

        //ターンとラウンドの管理
        if (rooms[roomIndex].turn < TURN) {
            //turnを進める
            rooms[roomIndex].turn = rooms[roomIndex].turn + 1;
        } else {
            //turnの初期化
            rooms[roomIndex].turn = 0;
            //roundの管理
            if (rooms[roomIndex].round < ROUND) {
                //roundを進める
                rooms[roomIndex].round = rooms[roomIndex].round + 1;

                //デッキの初期化
                rooms[roomIndex].deck = new Deck(1);

                //手札の初期化
                for (var i = 0; i < rooms[roomIndex].cards.length; i++) {
                    rooms[roomIndex].cards[i].card = [];
                    rooms[roomIndex].cards[i].num = 0;
                }
            } else {
                //gameの終了
                rooms[roomIndex].isGameOver = true;
            }
        }

        //roomの更新
        io.in(room.id).emit("updateRoom", room);
        console.log(room);
    });

    socket.on("action_rob", (target_name => {
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

        // 自分のcardを探す
        const myCardIndex = rooms[roomIndex].cards.findIndex((c) => c.userName === user.name);

        // 奪う相手のcardを探す
        const targetCardIndex = rooms[roomIndex].cards.findIndex((c) => c.userName === target_name);

        console.log(myCardIndex);
        console.log(targetCardIndex);

        console.log(rooms[roomIndex].cards[myCardIndex].card);
        console.log(rooms[roomIndex].cards[targetCardIndex].card);

        //自分の手札と相手の手札からランダムにROBofTIME回取り出す
        var my_sliced_card = [];
        var target_sliced_card = [];
        for (var i = 0; i < ROBofTIME; i++) {
            //自分のカードからランダムに取り出す
            var randomIndex = Math.floor(Math.random() * rooms[roomIndex].cards[myCardIndex].card.length);
            console.log("Random Index:", randomIndex);
            console.log("Available Cards:", rooms[roomIndex].cards[myCardIndex].card);
            console.log('my_sliced_card', my_sliced_card);
            my_sliced_card.push(rooms[roomIndex].cards[myCardIndex].card.splice(randomIndex, 1)[0]);
            //targetのカードからランダムに取り出す
            var randomIndex = Math.floor(Math.random() * rooms[roomIndex].cards[targetCardIndex].card.length);
            console.log("Random Index:", randomIndex);
            console.log("Available Cards:", rooms[roomIndex].cards[myCardIndex].card);
            console.log('target_sliced_card', target_sliced_card);
            target_sliced_card.push(rooms[roomIndex].cards[targetCardIndex].card.splice(randomIndex, 1)[0]);

        }
        console.log(my_sliced_card);
        console.log(target_sliced_card);

        console.log(rooms[roomIndex].cards[myCardIndex].card);
        console.log(rooms[roomIndex].cards[targetCardIndex].card);

        //取り出したカードの交換
        rooms[roomIndex].cards[myCardIndex].card = rooms[roomIndex].cards[myCardIndex].card.concat(target_sliced_card);
        rooms[roomIndex].cards[myCardIndex].card.sort();

        rooms[roomIndex].cards[targetCardIndex].card = rooms[roomIndex].cards[targetCardIndex].card.concat(my_sliced_card);
        rooms[roomIndex].cards[targetCardIndex].card.sort();


        // ターンプレイヤーを次のユーザーに進める
        rooms[roomIndex].turnUserIndex = getNextTurnUserIndex(room);

        //turnを進める
        rooms[roomIndex].turn = rooms[roomIndex].turn + 1;

        //ターンとラウンドの管理
        if (rooms[roomIndex].turn < TURN) {
            //turnを進める
            rooms[roomIndex].turn = rooms[roomIndex].turn + 1;
        } else {
            //turnの初期化
            rooms[roomIndex].turn = 0;
            //roundの管理
            if (rooms[roomIndex].round < ROUND) {
                //roundを進める
                rooms[roomIndex].round = rooms[roomIndex].round + 1;
                //デッキの初期化
                rooms[roomIndex].deck = new Deck(1);
                //手札の初期化
                for (var i = 0; i < rooms[roomIndex].cards.length; i++) {
                    rooms[roomIndex].cards[i].card = [];
                    rooms[roomIndex].cards[i].num = 0;
                }
            } else {
                //gameの終了
                rooms[roomIndex].isGameOver = true;
            }
        }

        //roomの更新
        io.in(room.id).emit("updateRoom", room);
        io.to(socket.id).emit("notifyError", "奪ったカード : " + target_sliced_card.toString() + " 奪われたカード : " + my_sliced_card.toString());
    }));

    socket.on('action_collect', async (collect) => {
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

        // 既存の連想配列を検索してuserNameが一致するcardを探す
        const targetCardIndex = rooms[roomIndex].cards.findIndex((c) => c.userName === user.name);

        //DB access
        try {
            const query_1 = `select * from godwordtable where title = '${collect}';`;
            const result_1 = await client.query(query_1);

            if (result_1.rows[0]) {
                console.log("データが存在します。");
                //提出したcardの削除
                for (let i = rooms[roomIndex].cards[targetCardIndex].card.length - 1; i >= 0; i--) {
                    if (collect.includes(rooms[roomIndex].cards[targetCardIndex].card[i])) {
                        rooms[roomIndex].cards[targetCardIndex].card.splice(i, 1);
                    }
                }
                //カードの枚数を更新
                rooms[roomIndex].cards[targetCardIndex].num = rooms[roomIndex].cards[targetCardIndex].card.length;
                //point加算
                rooms[roomIndex].points[targetCardIndex].point = rooms[roomIndex].points[targetCardIndex].point + collect.length;
            } else {
                console.log("データは存在しません。");
                io.to(socket.id).emit("notifyError", "データは存在しません");
                return
            }
        } catch (err) {
            console.error('Error querying database:', err);
            return
        }

        // ターンプレイヤーを次のユーザーに進める
        rooms[roomIndex].turnUserIndex = getNextTurnUserIndex(room);

        //turnを進める
        rooms[roomIndex].turn = rooms[roomIndex].turn + 1;

        //ターンとラウンドの管理
        if (rooms[roomIndex].turn < TURN) {
            //turnを進める
            rooms[roomIndex].turn = rooms[roomIndex].turn + 1;
        } else {
            //turnの初期化
            rooms[roomIndex].turn = 0;
            //roundの管理
            if (rooms[roomIndex].round < ROUND) {
                //roundを進める
                rooms[roomIndex].round = rooms[roomIndex].round + 1;

                //デッキの初期化
                rooms[roomIndex].deck = new Deck(1);

                //手札の初期化
                for (var i = 0; i < rooms[roomIndex].cards.length; i++) {
                    rooms[roomIndex].cards[i].card = [];
                    rooms[roomIndex].cards[i].num = 0;
                }
            } else {
                //gameの終了
                rooms[roomIndex].isGameOver = true;
            }
        }

        //roomの更新
        io.in(room.id).emit("updateRoom", room);
        io.to(socket.id).emit("notifyError", "正解");
    });


    // 最初から始める
    socket.on("restart", () => {
        const user = users.find((u) => u.id == socket.id);
        const roomIndex = rooms.findIndex((r) => r.id == user.roomId);
        const room = rooms[roomIndex];
        rooms[roomIndex].posts.length = 0;

        //デッキの初期化
        rooms[roomIndex].deck = new Deck(1);

        //手札の初期化
        for (var i = 0; i < rooms[roomIndex].cards.length; i++) {
            rooms[roomIndex].cards[i].card = [];
            rooms[roomIndex].cards[i].num = 0;
        }

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
    });

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
