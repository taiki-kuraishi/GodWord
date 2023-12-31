//    ______              __ _       __                      __
//   / ____/  ____   ____/ /| |     / /  ____    _____  ____/ /
//  / / __   / __ \ / __  / | | /| / /  / __ \  / ___/ / __  /
// / /_/ /  / /_/ // /_/ /  | |/ |/ /  / /_/ / / /    / /_/ /
// \____/   \____/ \__,_/   |__/|__/   \____/ /_/     \__,_/

import Deck from './src/deck.mjs';

import CRC32 from 'crc-32';

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

const SCORE_TABLE_LIST = ['7', '6', '5', '4', '3', '2', '1', '-5'];

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
            room.hash_dict = {};
            for (var i = 0; i < ROUND_TITLE_AMOUNT; i++) {
                const popped_title = room.title_list.pop();
                room.round_title_list.push(popped_title);
                room.hash_dict[popped_title] = popped_title;
            }
        } else {
            //gameの終了
            room.isGameOver = true;
        }
    }
    return room;
}

//hash
function calculateCRC32(room, inputString) {
    var crcValue = CRC32.str(inputString).toString(36).toLowerCase();
    //マイナスの検知
    if (crcValue[0] == '-') {
        crcValue = crcValue.slice(1);
    }
    //ダブり検知
    if (room.round_title_list.includes(crcValue)) {
        crcValue = calculateCRC32(room, crcValue)
    }
    return crcValue;
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
            hash_dict: {},
            deck: new Deck(1),
            cards: {
                [userName]: []
            },
            used_count: {
                "0": 0,
                "1": 0,
                "2": 0,
                "3": 0,
                "4": 0,
                "5": 0,
                "6": 0,
                "7": 0,
                "8": 0,
                "9": 0,
                "a": 0,
                "b": 0,
                "c": 0,
                "d": 0,
                "e": 0,
                "f": 0,
                "g": 0,
                "h": 0,
                "i": 0,
                "j": 0,
                "k": 0,
                "l": 0,
                "m": 0,
                'n': 0,
                "o": 0,
                "p": 0,
                "q": 0,
                "r": 0,
                "s": 0,
                "t": 0,
                "u": 0,
                "v": 0,
                "w": 0,
                "x": 0,
                "y": 0,
                "z": 0,
            },
            word_score_table: {
                '7': ["0",
                    "1",
                    "2",
                    "3",
                    "4",
                    "5",
                    "6",
                    "7",
                    "8",
                    "9",
                    "a",
                    "b",
                    "c",
                    "d",
                    "e",
                    "f",
                    "g",
                    "h",
                    "i",
                    "j",
                    "k",
                    "l",
                    "m",
                    'n',
                    "o",
                    "p",
                    "q",
                    "r",
                    "s",
                    "t",
                    "u",
                    "v",
                    "w",
                    "x",
                    "y",
                    "z"], '6': [], '5': [], '4': [], '3': [], '2': [], '1': [], '-5': []
            },
            points: {
                [userName]: 0
            },
            isGameOver: false,
        };
        //DB access
        try {
            const query_1 = `SELECT * FROM godwordtable2 ORDER BY random() LIMIT 100;`;
            const result_1 = await client.query(query_1);

            for (const row of result_1.rows) {
                room.title_list.push(row.title);
            }
        } catch (err) {
            console.error('Error querying database:', err);
            return
        }

        //round_title_listとhash_dictの生成
        for (var i = 0; i < ROUND_TITLE_AMOUNT; i++) {
            const popped_title = room.title_list.pop()
            room.round_title_list.push(popped_title);
            room.hash_dict[popped_title] = popped_title;
        }
        console.log(room.hash_dict);

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
        for (const char of collect_array) {
            const delete_index = rooms[roomIndex].cards[user.name].findIndex(card => card == char);
            if (delete_index !== -1) {
                rooms[roomIndex].cards[user.name].splice(delete_index, 1);
            }
        }

        //手札にcharの追加
        rooms[roomIndex].cards[user.name].push(char);

        //手札のsort
        rooms[roomIndex].cards[user.name].sort();

        // ターンプレイヤーを次のユーザーに進める
        rooms[roomIndex].turnUserIndex = getNextTurnUserIndex(room);

        //ターンとラウンドの管理
        rooms[roomIndex] = process_turn(rooms[roomIndex]);

        //roomの更新
        io.in(room.id).emit("updateRoom", room);

        console.log('\n<--- action_exchange --->\n', room);
        console.log('\ncards : \n', rooms[roomIndex].cards);
    });

    //hash
    socket.on('action_hash', (index) => {
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

        //hashの生成
        const hash_title = calculateCRC32(rooms[roomIndex], rooms[roomIndex].round_title_list[index]);

        //hash化したものをhash_dictに代入
        rooms[roomIndex].hash_dict[rooms[roomIndex].round_title_list[index]] = hash_title;

        // ターンプレイヤーを次のユーザーに進める
        rooms[roomIndex].turnUserIndex = getNextTurnUserIndex(room);

        //ターンとラウンドの管理
        rooms[roomIndex] = process_turn(rooms[roomIndex]);

        //roomの更新
        io.in(room.id).emit("updateRoom", room);
        io.to(room.id).emit("notifyError", "hash化が実行されました : " + rooms[roomIndex].round_title_list[index] + " --> " + hash_title);

        console.log('\n<--- action_hash --->\n', room);
        console.log('\nhash_dict : \n', rooms[roomIndex].hash_dict);


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

        //提出された文字の配列
        const collect_char_list = []

        //round_title_listにcollectが存在するか
        const foundIndex = rooms[roomIndex].round_title_list.findIndex(title => title === collect);
        //round_title_listにcollectが存在するか
        if (foundIndex !== -1) {
            console.log('\nData exists in round_title_list\n\troom.id : ', rooms[roomIndex].id, '\n\tuserName : ', user, '\n\tcollect : ', collect);
            //round_title_listから提出されたtitleの削除
            rooms[roomIndex].round_title_list.splice(foundIndex, 1);
            //手札から提出したカードの削除し、used_card_listに追加
            for (const char of collect_array) {
                const delete_index = rooms[roomIndex].cards[user.name].findIndex(card => card == char);
                if (delete_index !== -1) {
                    const deleted_card = rooms[roomIndex].cards[user.name].splice(delete_index, 1);
                    //used_cardの管理
                    rooms[roomIndex].used_count[deleted_card] += 1;
                    //collect_char_listに提出された文字の追加
                    collect_char_list.push(deleted_card);
                }
            }
        }
        //hash_dictにcollectが存在するか
        else if (Object.values(rooms[roomIndex].hash_dict).includes(collect)) {
            console.log('\nData exists in hash_dict\n\troom.id : ', rooms[roomIndex].id, '\n\tuserName : ', user, '\n\tcollect : ', collect);
            //提出されたhashのリセット
            for (var key in rooms[roomIndex].hash_dict) {
                if (rooms[roomIndex].hash_dict[key] == collect) {
                    rooms[roomIndex].hash_dict[key] = key;
                    break
                }
            }
            //手札から提出したカードの削除
            for (const char of collect_array) {
                const delete_index = rooms[roomIndex].cards[user.name].findIndex(card => card == char);
                if (delete_index !== -1) {
                    const deleted_card = rooms[roomIndex].cards[user.name].splice(delete_index, 1);
                    //used_cardの管理
                    rooms[roomIndex].used_count[deleted_card] += 1;
                    //collect_char_listに提出された文字の追加
                    collect_char_list.push(deleted_card);
                }
            }
        } else {
            io.to(socket.id).emit("notifyError", "データは存在しません");
            console.log('\nNot exist in round_title_list\n\troom.id : ', rooms[roomIndex].id, '\n\tuserName : ', user, '\n\tcollect : ', collect);
            return
        }

        //point処理
        for (var char of collect_char_list) {
            if (rooms[roomIndex].word_score_table['7'].includes(char[0])) {
                rooms[roomIndex].points[user.name] = rooms[roomIndex].points[user.name] + 7;
            } else if (rooms[roomIndex].word_score_table['6'].includes(char[0])) {
                rooms[roomIndex].points[user.name] = rooms[roomIndex].points[user.name] + 6;
            } else if (rooms[roomIndex].word_score_table['5'].includes(char[0])) {
                rooms[roomIndex].points[user.name] = rooms[roomIndex].points[user.name] + 5;
            } else if (rooms[roomIndex].word_score_table['4'].includes(char[0])) {
                rooms[roomIndex].points[user.name] = rooms[roomIndex].points[user.name] + 4;
            } else if (rooms[roomIndex].word_score_table['3'].includes(char[0])) {
                rooms[roomIndex].points[user.name] = rooms[roomIndex].points[user.name] + 3;
            } else if (rooms[roomIndex].word_score_table['2'].includes(char[0])) {
                rooms[roomIndex].points[user.name] = rooms[roomIndex].points[user.name] + 2;
            } else if (rooms[roomIndex].word_score_table['1'].includes(char[0])) {
                rooms[roomIndex].points[user.name] = rooms[roomIndex].points[user.name] + 1;
            } else if (rooms[roomIndex].word_score_table['-5'].includes(char[0])) {
                rooms[roomIndex].points[user.name] = rooms[roomIndex].points[user.name] + -5;
            } else {
                console.log('error at point')
            }
        }

        //word_score_tableの処理
        const used_count_values = Object.values(rooms[roomIndex].used_count);
        const uniqueValues_set = [...new Set(used_count_values)];
        var uniqueValues_list = Array.from(uniqueValues_set);
        uniqueValues_list.sort();

        // uniqueValues_listを連番に
        const consecutiveArray = [];
        for (let i = 0; i < uniqueValues_list.length; i++) {
            consecutiveArray.push(uniqueValues_list[i]); // 元の要素を追加

            if (i < uniqueValues_list.length - 1) {
                const current = uniqueValues_list[i];
                const next = uniqueValues_list[i + 1];

                if (next - current !== 1) {
                    const diff = next - current;

                    for (let j = 1; j < diff; j++) {
                        consecutiveArray.push(current + j); // 連番でない部分の要素を挿入
                    }
                }
            }
        }

        uniqueValues_list = consecutiveArray;

        //word_score_tableの初期化
        for (var key in rooms[roomIndex].word_score_table) {
            rooms[roomIndex].word_score_table[key] = [];
        }
        if (1 <= uniqueValues_list.length && uniqueValues_list.length <= 8) {
            for (var i = 0; i < SCORE_TABLE_LIST.length; i++) {
                for (var key in rooms[roomIndex].used_count) {
                    if (uniqueValues_list[0] == rooms[roomIndex].used_count[key]) {
                        rooms[roomIndex].word_score_table[SCORE_TABLE_LIST[i]].push(key)
                    }
                }
                uniqueValues_list.splice(0, 1);
                if (uniqueValues_list.length == 0) {
                    break
                }
            }
        }
        else if (8 < uniqueValues_list.length) {
            const top_list = uniqueValues_list.splice(0, uniqueValues_list.length - 8);
            for (var key in rooms[roomIndex].used_count) {
                if (top_list.includes(rooms[roomIndex].used_count[key])) {
                    rooms[roomIndex].word_score_table['7'].push(key)
                }
            }
            for (var i = 0; i < SCORE_TABLE_LIST.length; i++) {
                for (var key in rooms[roomIndex].used_count) {
                    if (uniqueValues_list[0] == rooms[roomIndex].used_count[key]) {
                        rooms[roomIndex].word_score_table[SCORE_TABLE_LIST[i]].push(key)
                    }
                }
                uniqueValues_list.splice(0, 1);
                if (uniqueValues_list.length == 0) {
                    break
                }
            }
        }
        else {
            console.log('error at score')
        }

        // ターンプレイヤーを次のユーザーに進める
        rooms[roomIndex].turnUserIndex = getNextTurnUserIndex(room);

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
        for (var key in room.cards) {
            room.cards[key] = [];
        }

        //used_cardの初期化
        rooms[roomIndex].used_count = {
            "0": 0,
            "1": 0,
            "2": 0,
            "3": 0,
            "4": 0,
            "5": 0,
            "6": 0,
            "7": 0,
            "8": 0,
            "9": 0,
            "a": 0,
            "b": 0,
            "c": 0,
            "d": 0,
            "e": 0,
            "f": 0,
            "g": 0,
            "h": 0,
            "i": 0,
            "j": 0,
            "k": 0,
            "l": 0,
            "m": 0,
            'n': 0,
            "o": 0,
            "p": 0,
            "q": 0,
            "r": 0,
            "s": 0,
            "t": 0,
            "u": 0,
            "v": 0,
            "w": 0,
            "x": 0,
            "y": 0,
            "z": 0,
        };

        //word_score_tableの初期化
        rooms[roomIndex].word_score_table = {
            '7': ["0",
                "1",
                "2",
                "3",
                "4",
                "5",
                "6",
                "7",
                "8",
                "9",
                "a",
                "b",
                "c",
                "d",
                "e",
                "f",
                "g",
                "h",
                "i",
                "j",
                "k",
                "l",
                "m",
                'n',
                "o",
                "p",
                "q",
                "r",
                "s",
                "t",
                "u",
                "v",
                "w",
                "x",
                "y",
                "z"], '6': [], '5': [], '4': [], '3': [], '2': [], '1': [], '-5': []
        };

        //pointの初期化
        for (var key in room.points) {
            rooms[roomIndex].cards[key] = 0;
        }

        //turnの初期化
        rooms[roomIndex].turn = 0;

        //roundの初期化
        rooms[roomIndex].round = 0;

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