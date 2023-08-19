<template>
  <div id="app">
    <!-- <link
      href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css"
      rel="stylesheet"
    /> -->
    <!-- ---------- HEAD ---------- -->

    <!-- 入室済の場合、部屋の情報を表示 -->
    <div v-if="isJoined">
      <h5>GOD WORD</h5>
      <div>{{ userName }} さん</div>
      部屋番号: {{ roomId }}
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
        <div>{{ turnUserName }}さんのターン:</div>
        <div>現在のラウンド : {{ round }}/5 ラウンド</div>
        <div>現在のターン : {{ turn }}/{{ turnsPerRound }} ターン</div>

        <!-- <input type="text" v-model="input" />
        <input type="button" value="送信" @click="postWord" /> -->
        <!-- 入力履歴 -->
        <div v-for="(post, i) in posts" :key="i">
          <div>{{ post.userName }} : " {{ post.word }} "</div>
        </div>
        <div v-for="(point, i) in points" :key="i">
          <div>{{ i }} : " {{ point }} "ポイント</div>
        </div>

        <!-- カード -->
        <div v-for="(card, i) in cards" :key="i">
          <div>{{ i }} : " {{ card }} "</div>
        </div>

        <!-- collect_input_box -->
        <input type="text" v-model="collectText" readonly />
        <!-- delete_button -->
        <input type="button" value="1文字消す" @click="pop_collect" />

        <!-- 手札ボタン -->
        <div>
          <input
            v-for="(card, i) in cards[userName]"
            :key="i"
            type="button"
            :value="card"
            v-bind:disabled="active_button(card, i)"
            @click="selectButton(card, i)"
            style="display: inline-block; margin-right: 10px"
          />
        </div>

        <!-- action -->
        <div>
          <div>
            <input type="button" value="ドロー" @click="action_draw" />
            <input type="button" value="2倍" @click="action_double" />
            <input type="button" value="奪う" @click="on_rob" />
            <input type="button" value="交換" @click="on_exchange" />
            <input type="button" value="提出" @click="action_collect" />
          </div>
          <!-- rob menu -->
          <div v-if="rob">
            <div>
              <div
                v-if="
                  2 <= Object.keys(cards).length && 3 <= cards[userName].length
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
          <div v-else></div>
        </div>
        <!-- round title list menu -->
        <div v-for="(word, index) in round_title_list" :key="index">
          <div
            style="display: flex; flex-direction: row; justify-content: center"
          >
            <p
              v-for="(char, index) in word"
              :key="index"
              :style="
                char in cards[userName]
                  ? 'color: red; margin: 0;'
                  : 'margin: 0;'
              "
            >
              {{ char }}
            </p>
          </div>
        </div>

        <!-- 終了ボタン -->
        <div>
          <input type="button" value="終了" @click="exit" />
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
    cards: {},
    collectArray: [],
    collectText: [],
    rob: false, //true : rob menuの表示, false : rob menuの非表示
    exchange: false, //true : exchange menuの表示, false : exchange menuの非表示
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
    points: {},
    isGameOver: false, //true : exchange menuの表示, false : exchange menuの非表示
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
      this.cards = room.cards;
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
    },
    off_exchange() {
      this.exchange = false;
    },

    action_exchange(char) {
      this.socket.emit("action_exchange", this.collectText, char);
      this.message = "";
    },

    //提出
    action_collect() {
      this.socket.emit("action_collect", this.collectText);
      this.message = "";
    },

    active_button(btn, index) {
      return (
        this.collectArray.find(
          (item) => item.index === index && item.btn === btn
        ) !== undefined
      );
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

h1{
  color: orange;
  font-style: italic;
  font-size: 130px;
}

h5 {
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
</style>
