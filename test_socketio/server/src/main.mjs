//このファイルは、card.mjsとdeck.mjsの動作を確認するものです
import Deck from './deck.mjs';

const deck = new Deck(1);
const drawnCards = deck.getCard(3);
console.log(deck);
console.log(drawnCards);