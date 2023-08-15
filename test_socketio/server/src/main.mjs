//このファイルは、card.mjsとdeck.mjsの動作を確認するものです
import Deck from './deck.mjs';

const deck = new Deck(1);

for (let i = 0; i <= 5; i++) {
    console.log(deck.cards);
    console.log(deck.getCard(3));
}