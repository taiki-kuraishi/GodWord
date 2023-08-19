//    ______              __ _       __                      __
//   / ____/  ____   ____/ /| |     / /  ____    _____  ____/ /
//  / / __   / __ \ / __  / | | /| / /  / __ \  / ___/ / __  /
// / /_/ /  / /_/ // /_/ /  | |/ |/ /  / /_/ / / /    / /_/ /
// \____/   \____/ \__,_/   |__/|__/   \____/ /_/     \__,_/

import Deck from './src/deck.mjs';

import { createServer } from "http";
import { Server } from "socket.io";

import pkg from 'pg';

//環境変数の読み込み
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pkg;
const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
});
//DBへの接続
client.connect(async (err) => {
    if (err) throw err;
    console.log('PostgreSQL Connected... query: 2');
});

const http = createServer();
const io = new Server(http, {
    cors: {
        origin: '*',
    },
});

const rooms = [];
const users = [];

const TURN = 15;
const ROUND = 3;

const EXODIA = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

const ROBofTIME = 3;
const ROUND_TITLE_AMOUNT = 10;

function process_turn(room) {
    if (room.turn < room.turnsPerRound) {
        //turnを進める
        room.turn = room.turn + 1;
    } else {
        //turnの初期化
        room.turn = 0;
        //roundの管理
        if (room.round < ROUND) {
            //roundを進める
            room.round = room.round + 1;

            //デッキの初期化
            room.deck = new Deck(1);

            //手札の初期化
            for (var key in room.cards) {
                room.cards[key] = [];
            }
            //round_title_listの初期化
            room.round_title_list = [];
            for (var i = 0; i < ROUND_TITLE_AMOUNT; i++) {
                room.round_title_list.push(room.title_list.pop());
            }
        } else {
            //gameの終了
            room.isGameOver = true;
        }
    }
    return room;
}

io.on("connection", (socket) => {
    // 部屋を新しく建てる
    socket.on("create", async (userName) => {
        if (userName == "") {
            io.to(socket.id).emit("notifyError", "名前を入力してください");
            console.log('\nNo name entered at create');
            return;
        }
        const roomId = generateRoomId();
        const user = { id: socket.id, name: userName, roomId };
        const room = {
            id: roomId,
            users: [user],
            turn: 0,
            turnsPerRound: 15,
            round: 0,
            turnUserIndex: 0,
            posts: [],
            title_list: [],
            round_title_list: [],
            deck: new Deck(1),
            cards: {
                [userName]: []
            },
            points: {
                [userName]: 0
            },
        };
        //DB access
        try {
            const query_1 = `SELECT * FROM godwordtable ORDER BY random() LIMIT 100;`;
            const result_1 = await client.query(query_1);

            for (const row of result_1.rows) {
                room.title_list.push(row.title);
            }
            console.log(room.title_list);
        } catch (err) {
            console.error('Error querying database:', err);
            return
        }

        for (var i = 0; i < ROUND_TITLE_AMOUNT; i++) {
            room.round_title_list.push(room.title_list.pop());
        }

        rooms.push(room);
        users.push(user);
        socket.join(roomId);

        io.to(socket.id).emit("updateRoom", room);

        console.log('\n<--- create --->\nroom : ', room);
        console.log('\ncards : \n', room.cards);
    });

    // 部屋に入室する
    socket.on("enter", (userName, roomId) => {
        if (userName == "") {
            io.to(socket.id).emit("notifyError", "名前を入力してください");
            console.log('\nNo name entered at enter')
            return;
        }
        const roomIndex = rooms.findIndex((r) => r.id == roomId);
        if (roomIndex == -1) {
            io.to(socket.id).emit("notifyError", "部屋が見つかりません");
            console.log('\nNo room found at enter');
            return;
        }
        const room = rooms[roomIndex];
        const user = { id: socket.id, name: userName, roomId };
        rooms[roomIndex].users.push(user);
        console.log(rooms[roomIndex].turnsPerRound)
        rooms[roomIndex].turnsPerRound = 15 * rooms[roomIndex].users.length;
        console.log(rooms[roomIndex].turnsPerRound)
        rooms[roomIndex].cards[user.name] = [];
        rooms[roomIndex].points[user.name] = 0;
        users.push(user);
        socket.join(rooms[roomIndex].id);
        io.in(room.id).emit("updateRoom", room);

        io.to(room.id).emit("notifyError", userName + "さんが参加しました。");

        console.log('\n<--- enter --->\nroom : ', room);
        console.log('\ncards : \n', rooms[roomIndex].cards);
    });

    // しりとりの単語を送信
    socket.on("post", (input) => {
        const user = users.find((u) => u.id == socket.id);
        const roomIndex = rooms.findIndex((r) => r.id == user.roomId);
        const room = rooms[roomIndex];

        // ターンプレイヤーかチェック
        if (room.users[room.turnUserIndex].id != socket.id) {
            io.to(socket.id).emit("notifyError", "あなたのターンではありません");
            console.log('Not your turn at post');
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
        // 送信したuser
        const user = users.find((u) => u.id == socket.id);
        // ルームのインデックス
        const roomIndex = rooms.findIndex((r) => r.id == user.roomId);
        const room = rooms[roomIndex];
        // ターンプレイヤーかチェック
        if (room.users[room.turnUserIndex].id != socket.id) {
            io.to(socket.id).emit("notifyError", "あなたのターンではありません");
            console.log('\nNot your turn at action_draw\n\troom.id : ', rooms[roomIndex].id, '\n\tuserName : ', user);
            return;
        }

        // カードをドローして手札に追加
        rooms[roomIndex].cards[user.name] = rooms[roomIndex].cards[user.name].concat(rooms[roomIndex].deck.getCard(3))


        //EXODIA
        var exodia_flg = false;
        if (EXODIA.every(card => rooms[roomIndex].cards[user.name].includes(card))) {
            console.log('\nEXODIA\n\t', rooms[roomIndex].id, '\n\tuserName : ', user);
            exodia_flg = true;
            //point加算
            rooms[roomIndex].points[user.name] = rooms[roomIndex].points[user.name] + 100;
            //turn 終了
            rooms[roomIndex].turn = TURN;
        }

        //sort cards
        rooms[roomIndex].cards[user.name].sort();

        // ターンプレイヤーを次のユーザーに進める
        rooms[roomIndex].turnUserIndex = getNextTurnUserIndex(room);

        //ターンとラウンドの管理
        rooms[roomIndex] = process_turn(rooms[roomIndex]);

        //roomの更新
        io.in(room.id).emit("updateRoom", room);

        if (exodia_flg) {
            io.to(socket.id).emit("notifyError", "EXODIA");
        }

        console.log('\n<--- action_draw --->\n', room);
        console.log('\ncards : \n', rooms[roomIndex].cards);
    });

    //2倍
    socket.on('action_double', (double_text) => {
        // 送信したuser
        const user = users.find((u) => u.id == socket.id);
        // ルームのインデックス
        const roomIndex = rooms.findIndex((r) => r.id == user.roomId);
        const room = rooms[roomIndex];

        //inputの長さのチェック 1文字以上 1文字以下だったら return
        if (double_text.length !== 1) {
            io.to(socket.id).emit("notifyError", "2倍にできるのは1文字のみです");
            console.log('\nOnly one letter can be doubled at action_draw\n\troom.id : ', rooms[roomIndex].id, '\n\tuserName : ', user);
            return
        }
        // ターンプレイヤーかチェック
        if (room.users[room.turnUserIndex].id != socket.id) {
            io.to(socket.id).emit("notifyError", "あなたのターンではありません");
            console.log('\nNot your turn at action_draw\n\troom.id : ', rooms[roomIndex].id, '\n\tuserName : ', user);
            return;
        }

        // 該当するカードが見つかった場合、そのカードにdouble_textを追加
        rooms[roomIndex].cards[user.name].push(double_text);

        //sort cards
        rooms[roomIndex].cards[user.name].sort();

        // ターンプレイヤーを次のユーザーに進める
        rooms[roomIndex].turnUserIndex = getNextTurnUserIndex(room);

        //turnを進める
        rooms[roomIndex].turn = rooms[roomIndex].turn + 1;

        //ターンとラウンドの管理
        rooms[roomIndex] = process_turn(rooms[roomIndex]);
        //roomの更新
        io.in(room.id).emit("updateRoom", room);

        console.log('\n<--- action_double --->\n', room);
        console.log('\ncards : \n', rooms[roomIndex].cards);
    });

    //奪う
    socket.on("action_rob", (target_name => {
        // 送信したuser
        const user = users.find((u) => u.id == socket.id);
        // ルームのインデックス
        const roomIndex = rooms.findIndex((r) => r.id == user.roomId);
        const room = rooms[roomIndex];
        // ターンプレイヤーかチェック
        if (room.users[room.turnUserIndex].id != socket.id) {
            io.to(socket.id).emit("notifyError", "あなたのターンではありません");
            console.log('\nNot your turn at action_draw\n\troom.id : ', rooms[roomIndex].id, '\n\tuserName : ', user);
            return;
        }

        //自分の手札と相手の手札からランダムにROBofTIME回取り出す
        var my_sliced_card = [];
        var target_sliced_card = [];
        for (var i = 0; i < ROBofTIME; i++) {
            //自分のカードからランダムに取り出す
            var randomIndex = Math.floor(Math.random() * rooms[roomIndex].cards[user.name].length);
            my_sliced_card.push(rooms[roomIndex].cards[user.name].splice(randomIndex, 1)[0]);
            //targetのカードからランダムに取り出す
            var randomIndex = Math.floor(Math.random() * rooms[roomIndex].cards[target_name].length);
            target_sliced_card.push(rooms[roomIndex].cards[target_name].splice(randomIndex, 1)[0]);

        }
        //取り出したカードの交換
        rooms[roomIndex].cards[user.name] = rooms[roomIndex].cards[user.name].concat(target_sliced_card);
        rooms[roomIndex].cards[user.name].sort();

        rooms[roomIndex].cards[target_name] = rooms[roomIndex].cards[target_name].concat(my_sliced_card);
        rooms[roomIndex].cards[target_name].sort();


        // ターンプレイヤーを次のユーザーに進める
        rooms[roomIndex].turnUserIndex = getNextTurnUserIndex(room);

        //turnを進める
        rooms[roomIndex].turn = rooms[roomIndex].turn + 1;

        //ターンとラウンドの管理
        rooms[roomIndex] = process_turn(rooms[roomIndex]);

        //roomの更新
        io.in(room.id).emit("updateRoom", room);
        io.to(socket.id).emit("notifyError", "奪ったカード : " + target_sliced_card.toString() + " 奪われたカード : " + my_sliced_card.toString());

        console.log('\n<--- action_rob --->\n', room);
        console.log('\ncards : \n', rooms[roomIndex].cards);
    }));

    //交換
    socket.on('action_exchange', (collect, char) => {
        // 送信したuser
        const user = users.find((u) => u.id == socket.id);
        // ルームのインデックス
        const roomIndex = rooms.findIndex((r) => r.id == user.roomId);
        const room = rooms[roomIndex];
        // ターンプレイヤーかチェック
        if (room.users[room.turnUserIndex].id != socket.id) {
            io.to(socket.id).emit("notifyError", "あなたのターンではありません");
            console.log('\nNot your turn at action_draw\n\troom.id : ', rooms[roomIndex].id, '\n\tuserName : ', user);
            return;
        }

        //文字列を配列に変換
        const collect_array = Array.from(collect);

        //collect_arrayが手札に存在するか
        if (!collect_array.every(item => rooms[roomIndex].cards[user.name].includes(item))) {
            console.log('\nNot exist in your hand at action_exchange\n\troom.id : ', rooms[roomIndex].id, '\n\tuserName : ', user, '\n\tcollect : ', collect);
            return
        }

        //手札からcollectの削除
        for (let i = rooms[roomIndex].cards[user.name].length - 1; i >= 0; i--) {
            if (collect.includes(rooms[roomIndex].cards[user.name][i])) {
                rooms[roomIndex].cards[user.name].splice(i, 1);
            }
        }

        //手札にcharの追加
        rooms[roomIndex].cards[user.name].push(char);

        //手札のsort
        rooms[roomIndex].cards[user.name].sort();

        // ターンプレイヤーを次のユーザーに進める
        rooms[roomIndex].turnUserIndex = getNextTurnUserIndex(room);

        //turnを進める
        rooms[roomIndex].turn = rooms[roomIndex].turn + 1;

        //ターンとラウンドの管理
        rooms[roomIndex] = process_turn(rooms[roomIndex]);

        //roomの更新
        io.in(room.id).emit("updateRoom", room);

        console.log('\n<--- action_exchange --->\n', room);
        console.log('\ncards : \n', rooms[roomIndex].cards);
    });

    //提出
    socket.on('action_collect', async (collect) => {
        // 送信したuser
        const user = users.find((u) => u.id == socket.id);
        // ルームのインデックス
        const roomIndex = rooms.findIndex((r) => r.id == user.roomId);
        const room = rooms[roomIndex];
        // ターンプレイヤーかチェック
        if (room.users[room.turnUserIndex].id != socket.id) {
            io.to(socket.id).emit("notifyError", "あなたのターンではありません");
            console.log('\nNot your turn at action_draw\n\troom.id : ', rooms[roomIndex].id, '\n\tuserName : ', user);
            return;
        }

        //文字列を配列に変換
        const collect_array = Array.from(collect);

        //collect_arrayが手札に存在するか
        if (!collect_array.every(item => rooms[roomIndex].cards[user.name].includes(item))) {
            console.log('\nNot exist in your hand at action_collect\n\troom.id : ', rooms[roomIndex].id, '\n\tuserName : ', user, '\n\tcollect : ', collect);
            return
        }

        //round_title_listにcollectが存在するか
        if (rooms[roomIndex].round_title_list.includes(collect)) {
            console.log('\nData exists in round_title_list\n\troom.id : ', rooms[roomIndex].id, '\n\tuserName : ', user, '\n\tcollect : ', collect);
            //手札から提出したカードの削除
            for (let i = rooms[roomIndex].cards[user.name].length - 1; i >= 0; i--) {
                if (collect.includes(rooms[roomIndex].cards[user.name][i])) {
                    rooms[roomIndex].cards[user.name].splice(i, 1);
                }
            }
            //point加算
            rooms[roomIndex].points[user.name] = rooms[roomIndex].points[user.name] + collect.length;
        } else {
            io.to(socket.id).emit("notifyError", "データは存在しません");
            console.log('\nNot exist in round_title_list\n\troom.id : ', rooms[roomIndex].id, '\n\tuserName : ', user, '\n\tcollect : ', collect);
            return
        }

        // ターンプレイヤーを次のユーザーに進める
        rooms[roomIndex].turnUserIndex = getNextTurnUserIndex(room);

        //turnを進める
        rooms[roomIndex].turn = rooms[roomIndex].turn + 1;

        //ターンとラウンドの管理
        rooms[roomIndex] = process_turn(rooms[roomIndex]);

        //roomの更新
        io.in(room.id).emit("updateRoom", room);
        io.to(socket.id).emit("notifyError", "正解");

        console.log('\n<--- action_collect --->\n', room);
        console.log('\ncards : \n', rooms[roomIndex].cards);
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

        console.log('\n<--- action_restart --->\n', room);
        console.log('\ncards : \n', rooms[roomIndex].cards);
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

        console.log('\n<--- action_exit --->\n', room);
        console.log('\ncards : \n', rooms[roomIndex].cards);
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

        console.log('\n<--- action_disconnect --->\n', room);
        console.log('\ncards : \n', rooms[roomIndex].cards);
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

// 次のターンプレイヤーのindexを返却
function getNextTurnUserIndex(room) {
    return room.turnUserIndex == room.users.length - 1
        ? 0
        : room.turnUserIndex + 1;
}

http.listen(3031);