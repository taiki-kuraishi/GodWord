<template>
  <div id="app">
    <h5>test socket.io</h5>
    <!-- 入室済の場合、部屋の情報を表示 -->
    <div v-if="isJoined">
      <div>{{ userName }} さん</div>
      部屋番号: {{ roomId }}
    </div>

    <!-- 未入室の場合、部屋を作る or 部屋に入るを選択 -->
    <div v-else>
      <div>名前: <input v-model="userName" type="text" /></div>

      <input type="radio" v-model="joinType" value="1" />新しく部屋を作る
      <input type="radio" v-model="joinType" value="2" />友達の部屋に入る

      <div v-if="joinType == 1">
        <input type="button" value="部屋を作る" @click="createRoom" />
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

    <!-- しりとり表示 -->
    <div v-if="isJoined">
      <!-- ゲームオーバー時の表示 -->
      <div v-if="isGameOver">
        <div style="color: red">{{ posts[0].userName }} さんの負け</div>
        <input type="button" value="最初から" @click="restart" />
      </div>

      <!-- 入力欄 -->
      <div v-else>
        <div>{{ turnUserName }}さんのターン:</div>

        <!-- <input type="text" v-model="input" />
        <input type="button" value="送信" @click="postWord" /> -->
      </div>

      <!-- 入力履歴 -->
      <div v-for="(post, i) in posts" :key="i">
        <div>{{ post.userName }} : " {{ post.word }} "</div>
      </div>

      <!-- カード -->
      <div v-for="(card, i) in cards" :key="i">
        <div>{{ card.userName }} : " {{ card.card }} "</div>
      </div>

      <!-- collect_input_box -->
      <input type="text" v-model="collectText" readonly />
      <!-- delete_button -->
      <input type="button" value="1文字消す" @click="pop_collect" />
      <p>{{ cards }}</p>
      <p>{{ collectArray }}</p>

      <!-- ボタン -->
      <!-- <p>{{ cards[0].card }}</p>
      <p>{{ userName }}</p>
      <p>{{ cards[0].userName }}</p> -->
      <div v-for="(card, i) in cards" :key="i">
        <div v-if="card.userName == userName">
          <!-- <p>{{ card }}</p> -->
          <input
            v-for="(btn, i) in card.card"
            :key="i"
            type="button"
            :value="btn"
            v-bind:disabled="active_button(btn, i)"
            @click="selectButton(btn, i)"
            style="display: inline-block; margin-right: 10px"
          />
        </div>
      </div>

      <!-- action -->
      <div>
        <input type="button" value="ドロー" @click="action_draw" />
        <input type="button" value="2倍" @click="action_double" />
        <input type="button" value="提出" @click="action_collect" />
      </div>

      <!-- 終了ボタン -->
      <div>
        <input type="button" value="終了" @click="exit" />
      </div>
    </div>
  </div>
</template>

<script>
import io from "socket.io-client";
export default {
  name: "App",
  data: () => ({
    userName: "",
    joinType: 1,
    isJoined: false,
    roomId: "",
    message: "",
    input: "",
    turnUserName: "",
    posts: [],
    cards: [],
    collectArray: [],
    collectText: [],
    action: -1,
    isGameOver: false,
    socket: io("http://localhost:3031"),
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
      this.turnUserName = room.users[room.turnUserIndex].name;
      this.posts = room.posts;
      this.cards = room.cards;
      this.actions = -1;
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
  text-align: center;
}
</style>
