// deck.js
import Card from './card.mjs';
import shuffle from 'lodash/shuffle.js';

export default class Deck {
    constructor(deckSetCount = 1) {
        this.cards = [];
        for (let index = 0; index < deckSetCount; index++) {
            for (let key = 0; key < Object.keys(Card.STRINGS).length; key++) {
                for (let i = 0; i < Deck.CARD_NUMBER; i++) {
                    this.cards.push(new Card(key).card_value);
                }
            }
        }
        this.cards = shuffle(this.cards);
    }

    getCard(cardNum = 3) {
        const cardList = [];
        if (this.cards.length === 0) {
            return null;
        }
        for (let index = 0; index < cardNum; index++) {
            cardList.push(this.cards.pop());
        }
        return cardList;
    }
}

Deck.CARD_NUMBER = 4;
Deck.DRAW_NUMBER = 3;
