<template>
  <div id="app">
    <!-- <link
      href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css"
      rel="stylesheet"
    /> -->
    <!-- ---------- HEAD ---------- -->

    <!-- 入室済の場合、部屋の情報を表示 -->
    <div v-if="isJoined">
      <div class="title">
        <h2>
          GOD WORD<input
            type="button"
            value="終了"
            class="exitbutton"
            @click="exit"
          /><br />
        </h2>
        <!-- 終了ボタン -->
      </div>

      <div class="player_info">
        {{ userName }} さん<br />
        部屋番号: {{ roomId }}
      </div>
    </div>

    <!-- 未入室の場合、部屋を作る or 部屋に入るを選択 -->
    <div v-else>
      <h1>GOD WORD</h1>
      <div>名前: <input v-model="userName" type="text" /></div>

      <input
        type="radio"
        v-model="joinType"
        class="create_room"
        value="1"
      />新しく部屋を作る
      <input
        type="radio"
        v-model="joinType"
        class="create_room"
        value="2"
      />友達の部屋に入る

      <div v-if="joinType == 1">
        <input
          type="button"
          class="create_room_button"
          value="部屋を作る"
          @click="createRoom"
        />
      </div>

      <div v-if="joinType == 2">
        部屋番号: <input v-model="roomId" type="text" />
        <input type="button" value="入室" @click="enterRoom" />
      </div>
    </div>

    <div style="color: red">
      {{ message }}
    </div>

    <hr />
    <!-- ---------- Body ---------- -->

    <!-- しりとり表示 -->
    <div v-if="isJoined">
      <!-- ゲームオーバー時の表示 -->
      <div v-if="isGameOver">
        <!-- <div style="color: red">{{ posts[0].userName }} さんの負け</div> -->
        <div v-for="(point, i) in points" :key="i">
          <div>{{ i }} : " {{ point }} "ポイント</div>
        </div>
        <input type="button" value="最初から" @click="restart" />
      </div>

      <!-- 入力欄 -->
      <div v-else>
        <div class="container">
          <div class="turn-round">
            <div>{{ turnUserName }}さんのターン:</div>
            <div>現在のラウンド : {{ round }}/3 ラウンド</div>
            <div>現在のターン : {{ turn }}/{{ turnsPerRound }} ターン</div>
          </div>

          <div class="enemy-card">
            <div v-for="(point, i, j) in points" :key="i">
              <div v-if="i != userName"></div>
              <div>{{ i }}さん : " {{ point }} "ポイント</div>
              <div>
                <input
                  v-for="(card, index) in cards[i]"
                  :key="index"
                  type="button"
                  :value="card"
                  style="display: inline-block; margin-right: 10px"
                  :style="button_color_list[j]"
                  readonly
                />
              </div>
            </div>
          </div>

          <!-- round title list menu -->
          <div class="title-menu">
            <div v-for="(word, i) in hash_dict" :key="i">
              <div
                style="
                  display: flex;
                  flex-direction: row;
                  justify-content: center;
                "
              >
                <div v-for="(char, j) in word" :key="j">
                  <div v-if="cards[userName].includes(char)">
                    <p style="color: red; margin: 0px">{{ char }}</p>
                  </div>
                  <div v-else>
                    <p style="margin: 0px">{{ char }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 手札ボタン -->
          <div class="hand">
            <input
              v-for="(card, i) in cards[userName]"
              :key="i"
              type="button"
              :value="card"
              v-bind:disabled="active_button(card, i)"
              @click="selectButton(card, i)"
              style="display: inline-block; margin-right: 10px"
              class="card"
            />
          </div>

          <!-- action -->
          <div class="action">
            <input
              type="button"
              value="ドロー"
              @click="action_draw"
              class="action_button"
            />
            <input
              type="button"
              value="2倍"
              @click="action_double"
              class="action_button"
            />
            <input
              type="button"
              value="奪う"
              @click="on_rob"
              class="action_button"
            />
            <input
              type="button"
              value="交換"
              @click="on_exchange"
              class="action_button"
            />
            <input
              type="button"
              value="ハッシュ"
              @click="on_hash"
              class="action_button"
            />
            <input
              type="button"
              value="提出"
              @click="action_collect"
              class="action_button"
            />
            <!-- collect_input_box -->
            <input type="text" v-model="collectText" readonly />
            <!-- delete_button -->
            <input
              type="button"
              value="1文字消す"
              @click="pop_collect"
              class="delete_button"
            />

            <!-- rob menu -->
            <div v-if="rob">
              <div>
                <div
                  v-if="
                    2 <= Object.keys(cards).length &&
                    3 <= cards[userName].length
                  "
                >
                  <div><p>奪う相手を選択してください</p></div>
                  <div v-for="(card, i) in cards" :key="i">
                    <input
                      v-if="i != userName"
                      type="button"
                      :value="i"
                      v-bind:disabled="rob_active_user(card.length)"
                      @click="action_rob(i)"
                      style="display: inline-block; margin-right: 10px"
                    />
                  </div>
                </div>
                <div v-else-if="rob && Object.keys(cards).length < 2">
                  <p>奪う相手がいません</p>
                </div>
                <div v-else-if="rob && cards[userName].length < 3">
                  <p>手札の枚数が足りません</p>
                </div>
                <input type="button" value="キャンセル" @click="off_rob" />
              </div>
            </div>

            <!-- exchange menu -->
            <div v-else-if="exchange">
              <div>
                <div v-if="4 <= cards[userName].length">
                  <p>入手したい文字を選んでください</p>
                  <input
                    v-for="(char, i) in exchange_character_list"
                    :key="i"
                    type="button"
                    :value="char"
                    v-bind:disabled="exchange_button_disabled()"
                    @click="action_exchange(char)"
                    style="display: inline-block; margin-right: 10px"
                  />
                </div>
                <div v-if="cards[userName].length < 4">
                  <p>カードの枚数が足りません</p>
                </div>
                <div v-if="collectText.length < 4 || 4 < collectText.length">
                  <p>交換するには4文字の入力が必要です</p>
                </div>
                <input type="button" value="キャンセル" @click="off_exchange" />
              </div>
            </div>
            <!-- hash menu -->
            <div v-else-if="hash">
              <p>hashをかけたいtitleを選んでください</p>
              <div
                v-for="(word, index) in round_title_list"
                :key="index"
                style="
                  display: flex;
                  justify-content: space-around;
                  flex-wrap: wrap;
                  flex-basis: 20%;
                  margin-bottom: 10px;
                  display: inline-block;
                "
              >
                <input
                  type="button"
                  :value="word"
                  @click="action_hash(index)"
                />
              </div>
              <br />
              <input type="button" value="キャンセル" @click="off_hash" />
            </div>
            <div v-else></div>
          </div>
          <!-- word_score_table menu -->
          <div class="score-table">
            <table border="1" style="margin: auto">
              <thead>
                <tr>
                  <th>点数</th>
                  <th>文字</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(value, key) in word_score_table" :key="key">
                  <td>{{ key }}</td>
                  <td>
                    <div
                      style="
                        display: flex;
                        flex-direction: row;
                        justify-content: center;
                      "
                    >
                      <p
                        v-for="(char, i) in value"
                        :key="i"
                        style="margin: 10px"
                      >
                        {{ char }}
                      </p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import io from "socket.io-client";
export default {
  name: "App",
  data: () => ({
    userName: "", //userName
    joinType: 1, //1 : でroomの作成 , 2 : roomへの参加
    isJoined: false, //true : roomへ参加済み, false : roomへ未参加
    roomId: "",
    message: "",
    input: "",
    turn: 0,
    turnsPerRound: 15,
    round: 0,
    turnUserName: "",
    posts: [],
    round_title_list: [],
    hash_dict: {},
    cards: {},
    temp_cards: {},
    collectArray: [],
    collectText: [],
    rob: false, //true : rob menuの表示, false : rob menuの非表示
    exchange: false, // true : exchange menuの表示, false : exchange menuの非表示
    hash: false, // true : hash menuの表示, false : hash menuの非表示
    exchange_character_list: [
      "0",
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
      "n",
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
      "z",
    ],
    used_count: {},
    word_score_table: {},
    points: {},
    isGameOver: false, //true : exchange menuの表示, false : exchange menuの非表示
    button_color_list: [
      "background-color: rgb(148, 238, 255)",
      "background-color: rgb(203, 168, 211)",
      "background-color: rgb(255, 135, 160)",
      "background-color: rgb(218, 200, 171)",
    ],
    socket: io("http://localhost:3031"), //宛先 hamachiを使用する場合は,hamachiのIPに書き換えたください
  }),

  created() {
    this.socket.on("connect", () => {
      console.log("connected");
    });
  },

  mounted() {
    this.socket.on("updateRoom", (room) => {
      this.isJoined = true;
      this.roomId = room.id;
      this.message = "";
      this.turn = room.turn;
      this.turnsPerRound = room.turnsPerRound;
      this.round = room.round;
      this.turnUserName = room.users[room.turnUserIndex].name;
      this.posts = room.posts;
      this.round_title_list = room.round_title_list;
      this.hash_dict = room.hash_dict;
      this.cards = room.cards;
      this.used_count = room.used_count;
      this.word_score_table = room.word_score_table;
      this.points = room.points;
      (this.collectArray = []), (this.collectText = []), (this.input = "");
      this.isGameOver = room.isGameOver;
    });

    this.socket.on("notifyError", (error) => {
      this.message = error;
    });

    this.socket.on("notifyDisconnection", (userName, turnUserName) => {
      this.message = userName + " さんが退室しました";
      this.turnUserName = turnUserName;
    });
  },

  methods: {
    createRoom() {
      this.socket.emit("create", this.userName);
      this.message = "";
    },

    enterRoom() {
      this.socket.emit("enter", this.userName, this.roomId);
      this.message = "";
    },

    postWord() {
      this.socket.emit("post", this.input);
      this.message = "";
    },

    //ボタン
    selectButton(btn, index) {
      this.collectArray.push({ index: index, btn: btn });
      this.collectText = this.collectArray.map((item) => item.btn).join("");
    },

    //一度押したカードは押せなくなる処理
    active_button(btn, index) {
      return (
        this.collectArray.find(
          (item) => item.index === index && item.btn === btn
        ) !== undefined
      );
    },

    //1文字消す
    pop_collect() {
      this.collectArray.pop();
      this.collectText = this.collectText.slice(0, -1);
    },

    //ドロー
    action_draw() {
      this.socket.emit("action_draw");
      this.message = "";
    },

    //2倍
    action_double() {
      this.socket.emit("action_double", this.collectText);
      this.message = "";
    },

    // rob menu 表示 非表示
    on_rob() {
      this.rob = true;
      this.exchange = false;
      this.hash = false;
    },

    off_rob() {
      this.rob = false;
    },

    //奪う
    rob_active_user(num_of_cards) {
      if (num_of_cards < 3) {
        return true;
      } else {
        return false;
      }
    },

    action_rob(target_name) {
      this.socket.emit("action_rob", target_name);
      this.message = "";
    },

    //exchange
    on_exchange() {
      this.exchange = true;
      this.rob = false;
      this.hash = false;
    },
    off_exchange() {
      this.exchange = false;
    },

    exchange_button_disabled() {
      if (this.collectText.length == 4) {
        return false;
      } else {
        return true;
      }
    },

    action_exchange(char) {
      this.socket.emit("action_exchange", this.collectText, char);
      this.message = "";
    },

    //hash
    on_hash() {
      this.hash = true;
      this.rob = false;
      this.exchange = false;
    },
    off_hash() {
      this.hash = false;
    },
    action_hash(index) {
      this.socket.emit("action_hash", index);
      this.message = "";
    },

    //提出
    action_collect() {
      this.socket.emit("action_collect", this.collectText);
      this.message = "";
    },

    restart() {
      this.socket.emit("restart");
      this.message = "";
    },

    exit() {
      this.socket.emit("exit");
      this.message = "";
    },
  },
};
</script>

<style>
#app {
  padding: 1em;
  text-align: center;
  background-color: #55bb99;
}

h1 {
  color: orange;
  font-style: italic;
  font-size: 130px;
  text-shadow: -10px -20px 3px #808080;
}

h2 {
  color: orange;
  font-style: italic;
}

.create_room_button {
  display: block;
  text-align: center;
  text-decoration: none;
  width: 240px;
  margin: auto;
  padding: 1rem 4rem;
  font-weight: bold;
  border-radius: 0.3rem;
  border-bottom: 7px solid #0686b2;
  background: #27acd9;
  color: #fff;
}
.create_room_button:hover {
  margin-top: 6px;
  border-bottom: 1px solid #0686b2;
  color: #fff;
}

.action_button {
  text-align: center;
  text-decoration: none;
  font-weight: bold;
  border-radius: 0.3rem;
  border-bottom: 7px solid #0686b2;
  background: #27acd9;
  color: #fff;
}

.action_button:hover {
  border-bottom: 1px solid #0686b2;
  color: #fff;
}

.delete_button {
  text-align: center;
  text-decoration: none;
  font-weight: bold;
  border-radius: 0.3rem;
  border-bottom: 7px solid rgb(153, 0, 0);
  background: rgb(212, 0, 0);
  color: #fff;
}

.delete_button:hover {
  border-bottom: 1px solid rgb(153, 0, 0);
  color: #fff;
}

.player_info {
  border: solid;
  text-align: right;
  background: #fff;
}

.exitbutton {
  display: block;
  text-decoration: none;
  padding: auto;
  margin: auto;
  padding: 0.5em 2em;
  font-weight: bold;
  background: linear-gradient(to top, rgb(5, 130, 174), #27acd9);
  color: #fff;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  -webkit-box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  transition: 0.5s;
}
.exitbutton:hover {
  color: #fff;
  opacity: 0.5;
}

.card {
  width: 110px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  background-color: rgb(161, 255, 20);
  border-radius: 30px;
  color: rgb(19, 19, 19);
  font-weight: 600;
  border: none;
  position: relative;
  cursor: pointer;
  transition-duration: 0.2s;
  box-shadow: 5px 5px 10px rgba(0, 0, 0, 0.116);
  padding-left: 8px;
  transition-duration: 0.5s;
}

.card:hover {
  background-color: rgb(192, 255, 20);
  transition-duration: 0.5s;
}

.card:active {
  transform: scale(0.97);
  transition-duration: 0.2s;
}

.card:disabled {
  background-color: rgb(220, 255, 20);
}

.title.exitbutton {
  text-align: right;
  flex-direction: row;
  flex-wrap: wrap;
}

.container {
  display: grid;
  grid-template-rows: 10vw 1fr 1fr 1fr 1fr 1fr;
  grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr;
}
.turn-round {
  grid-row: 1;
  grid-column: 1/7;
}
.enemy-card {
  grid-row: 2;
  grid-column: 1/4;
  text-align: left;
}
.enemy-card input {
  width: 50px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  border-radius: 30px;
  color: rgb(19, 19, 19);
  font-weight: 600;
  border: none;
  position: relative;
  cursor: pointer;
  transition-duration: 0.2s;
  box-shadow: 5px 5px 10px rgba(0, 0, 0, 0.116);
  padding-left: 8px;
  transition-duration: 0.5s;
}
.title-menu {
  grid-row: 2;
  grid-column: 4/7;
  margin: 0px;
}
.hand {
  grid-row: 3;
  grid-column: 1/4;
}
.action {
  grid-row: 3;
  grid-column: 4/7;
}
.score-table {
  grid-row: 4;
  grid-column: 1/7;
}
</style>
