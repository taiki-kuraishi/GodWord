const card = ['a', 'b', 'c', 'd', 'e', 'f','g', 'h', 'i', 'j', 'k', 'l','m', 'n', 'o', 'p', 'q', 's','t', 'u', 'v', 'w', 'x', 'y','z']

export function get_card(){
    return card[Math.floor(Math.random()*card.length)];
}

// console.log(get_card());
