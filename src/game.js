// Rummikub AI engine v2
// Rules implemented: 106 tiles, 14-tile rack, 30-point initial meld,
// runs (same colour, consecutive values), groups (same value, distinct colours),
// table rearrangement after opening, and joker substitution/reuse support.

export const COLORS = ['red', 'blue', 'black', 'orange'];
const VALUES = Array.from({ length: 13 }, (_, i) => i + 1);

export const shuffle = (items) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

export const makeDeck = () => {
  const deck = [];
  COLORS.forEach((color) => VALUES.forEach((value) => {
    deck.push({ id: `${color}-${value}-a`, color, value });
    deck.push({ id: `${color}-${value}-b`, color, value });
  }));
  deck.push({ id: 'joker-a', joker: true, value: 0 });
  deck.push({ id: 'joker-b', joker: true, value: 0 });
  return shuffle(deck);
};

export const points = (tile) => tile.joker ? 30 : tile.value;
const cloneGroups = (groups = []) => groups.map((group) => [...group]);
const cloneGame = (game) => ({
  ...game,
  players: game.players.map((player) => ({ ...player, hand: [...player.hand] })),
  table: cloneGroups(game.table),
  pool: [...game.pool],
  discard: [...(game.discard || [])],
});

const isJoker = (tile) => Boolean(tile?.joker);
const normalTiles = (group) => group.filter((tile) => !isJoker(tile));

/**
 * Validates one meld. Jokers are wild and may fill missing positions.
 * A run must stay within 1..13. A group may contain at most four tiles.
 */
export function isValidGroup(group) {
  if (!Array.isArray(group) || group.length < 3 || group.length > 13) return false;
  const jokers = group.filter(isJoker).length;
  const normal = normalTiles(group);
  if (!normal.length || jokers > 2) return false;

  // Group: same number, different colours.
  if (normal.every((tile) => tile.value === normal[0].value)) {
    if (group.length > 4) return false;
    const colors = normal.map((tile) => tile.color);
    return new Set(colors).size === colors.length &&
      normal.every((tile) => COLORS.includes(tile.color));
  }

  // Run: same colour, no duplicate values, and every missing number is a joker.
  if (!normal.every((tile) => tile.color === normal[0].color)) return false;
  if (!normal.every((tile) => Number.isInteger(tile.value) && tile.value >= 1 && tile.value <= 13)) return false;
  const values = normal.map((tile) => tile.value).sort((a, b) => a - b);
  if (new Set(values).size !== values.length) return false;
  const span = values[values.length - 1] - values[0] + 1;
  return span === group.length && span <= 13;
}

export const isValidTable = (groups) =>
  Array.isArray(groups) && groups.length > 0 && groups.every(isValidGroup);

export function groupLabel(group) {
  const normal = normalTiles(group);
  if (!normal.length) return 'קבוצה';
  return normal.every((tile) => tile.value === normal[0].value) ? 'קבוצה' : 'רצף';
}

export function sortHand(hand) {
  return [...hand].sort((a, b) => {
    if (a.joker) return 1;
    if (b.joker) return -1;
    return COLORS.indexOf(a.color) - COLORS.indexOf(b.color) || a.value - b.value;
  });
}

// Generate all valid melds from a rack. This supports one/two jokers and
// duplicate physical tiles without treating equal copies as the same tile.
export function meldsFromHand(hand) {
  const result = [];
  const seen = new Set();
  const add = (tiles) => {
    if (tiles.length < 3 || !isValidGroup(tiles)) return;
    const key = tiles.map((tile) => tile.id).sort().join('|');
    if (!seen.has(key)) {
      seen.add(key);
      result.push(tiles);
    }
  };
  const jokers = hand.filter(isJoker);

  // Groups: enumerate all physical copies for each selected colour.
  for (let value = 1; value <= 13; value++) {
    for (let mask = 1; mask < 16; mask++) {
      const colors = COLORS.filter((_, index) => mask & (1 << index));
      if (colors.length < 3 || colors.length > 4) continue;
      const choices = colors.map((color) => hand.filter(
        (tile) => !tile.joker && tile.color === color && tile.value === value
      ));
      const chooseCopies = (position, selected) => {
        if (position === choices.length) {
          const missing = colors.length - selected.length;
          if (missing === 0) add(selected);
          else if (missing <= jokers.length && missing <= 2) {
            const jokerChoices = jokers.slice(0, missing);
            if (jokerChoices.length === missing) add([...selected, ...jokerChoices]);
          }
          return;
        }
        // A colour may be absent and represented by a joker.
        chooseCopies(position + 1, selected);
        for (const tile of choices[position]) chooseCopies(position + 1, [...selected, tile]);
      };
      chooseCopies(0, []);
    }
  }

  // Runs: recursively choose a physical tile for each value or a joker for a gap.
  for (const color of COLORS) {
    for (let start = 1; start <= 13; start++) {
      for (let length = 3; length <= 13 - start + 1; length++) {
        const window = Array.from({ length }, (_, i) => start + i);
        const walk = (position, selected, usedJokers) => {
          if (position === window.length) {
            add(selected);
            return;
          }
          const value = window[position];
          const copies = hand.filter((tile) => !tile.joker && tile.color === color && tile.value === value);
          for (const tile of copies) walk(position + 1, [...selected, tile], usedJokers);
          if (usedJokers < 2) {
            for (const joker of jokers) {
              if (!selected.some((tile) => tile.id === joker.id)) {
                walk(position + 1, [...selected, joker], usedJokers + 1);
              }
            }
          }
        };
        walk(0, [], 0);
      }
    }
  }

  return result.sort((a, b) =>
    b.reduce((sum, tile) => sum + points(tile), 0) -
    a.reduce((sum, tile) => sum + points(tile), 0)
  );
}

/** Finds the highest-value collection of non-overlapping melds in a rack. */
export function bestHandMelds(hand) {
  const melds = meldsFromHand(hand);
  const tileIndex = new Map(hand.map((tile, index) => [tile.id, index]));
  const byTile = hand.map((tile) => melds.filter((meld) => meld.some((item) => item.id === tile.id)));
  let best = { score: 0, groups: [], usedIds: new Set() };

  const search = (remaining, groups, score) => {
    if (score > best.score) {
      best = { score, groups: [...groups], usedIds: new Set(hand.filter((_, i) => !remaining.has(i)).map((tile) => tile.id)) };
    }
    if (!remaining.size) return;
    const index = [...remaining].sort((a, b) => byTile[a].length - byTile[b].length)[0];
    const without = new Set(remaining);
    without.delete(index);
    search(without, groups, score);
    for (const meld of byTile[index]) {
      const indices = meld.map((tile) => tileIndex.get(tile.id));
      if (!indices.every((i) => remaining.has(i))) continue;
      const next = new Set(remaining);
      indices.forEach((i) => next.delete(i));
      search(next, [...groups, meld], score + meld.reduce((sum, tile) => sum + points(tile), 0));
    }
  };

  search(new Set(hand.map((_, index) => index)), [], 0);
  return best.groups;
}

export function createGame(playerCount = 3, difficulty = 'medium') {
  const deck = makeDeck();
  const players = Array.from({ length: playerCount }, (_, index) => ({
    id: index,
    name: index === 0 ? 'את/ה' : `מחשב ${index}`,
    isHuman: index === 0,
    hand: deck.splice(0, 14),
    opened: false,
  }));
  return {
    players, table: [], pool: deck, discard: [], turn: 0,
    started: true, finished: false, message: 'המשחק התחיל! נסו לפתוח עם 30 נקודות לפחות.',
    difficulty, round: 1, consecutivePasses: 0,
  };
}

export function drawTile(game, playerIndex) {
  const next = cloneGame(game);
  if (!next.pool.length && next.discard.length > 1) {
    // Keep the latest discarded tile aside; shuffle the rest back into the pool.
    const last = next.discard[next.discard.length - 1];
    next.pool = shuffle(next.discard.slice(0, -1));
    next.discard = [last];
    next.message = 'הקופה התרוקנה – ערבבנו מחדש את האבנים שנאספו.';
  }
  if (!next.pool.length) {
    next.message = 'הקופה ריקה ואין אבנים נוספות לערבוב.';
    return next;
  }
  next.players[playerIndex].hand.push(next.pool.pop());
  next.consecutivePasses = (next.consecutivePasses || 0) + 1;
  return next;
}

function nextTurn(game, fromIndex) {
  return (fromIndex + 1) % game.players.length;
}

function finishTurn(game, playerIndex, table, hand, openedNow = false) {
  const next = cloneGame(game);
  next.table = cloneGroups(table);
  next.players[playerIndex].hand = [...hand];
  next.players[playerIndex].opened = next.players[playerIndex].opened || openedNow;
  next.consecutivePasses = 0;
  if (!hand.length) {
    next.finished = true;
    next.winner = playerIndex;
    next.message = playerIndex === 0 ? 'ניצחת! כל הכבוד 🎉' : `${next.players[playerIndex].name} ניצח/ה הפעם.`;
    return next;
  }
  next.turn = nextTurn(next, playerIndex);
  next.message = playerIndex === 0 ? 'מהלך חוקי! תור המחשב.' : `${next.players[playerIndex].name} סיים/ה תור.`;
  return next;
}

/**
 * Applies a human table proposal. Every old table tile must still be on the
 * table (unless the player opened and used it in a different valid meld).
 * For the opening turn, at least 30 points must come from the player's rack.
 */
export function applyHumanMove(game, nextTable, nextHand) {
  const player = game.players[0];
  const originalIds = new Set(player.hand.map((tile) => tile.id));
  const nextHandIds = new Set(nextHand.map((tile) => tile.id));
  const playedFromRack = player.hand.filter((tile) => !nextHandIds.has(tile.id));
  const returnedToRack = nextHand.filter((tile) => !originalIds.has(tile.id));

  if (!Array.isArray(nextTable) || !nextTable.length || !nextTable.every(isValidGroup)) {
    return { ...game, message: 'המהלך אינו חוקי: כל הסדרות חייבות להכיל לפחות 3 אבנים ולהיות תקינות.' };
  }

  // Prevent tiles from being duplicated or disappearing.
  const tableIds = nextTable.flat().map((tile) => tile.id);
  if (new Set(tableIds).size !== tableIds.length || new Set(nextHand.map((tile) => tile.id)).size !== nextHand.length) {
    return { ...game, message: 'זוהתה אבן כפולה. המהלך בוטל.' };
  }
  const allBefore = new Set([...game.table.flat().map((tile) => tile.id), ...player.hand.map((tile) => tile.id)]);
  const allAfter = new Set([...tableIds, ...nextHand.map((tile) => tile.id)]);
  if (allBefore.size !== allAfter.size || [...allBefore].some((id) => !allAfter.has(id))) {
    return { ...game, message: 'חלק מהאבנים חסרות או נוספו בטעות. המהלך בוטל.' };
  }

  if (!player.opened) {
    if (game.table.length) return { ...game, message: 'לפני הפתיחה הראשונה לא ניתן לשנות סדרות קיימות.' };
    const openingPoints = playedFromRack.reduce((sum, tile) => sum + points(tile), 0);
    if (openingPoints < 30) {
      return { ...game, message: `הפתיחה שלך היא ${openingPoints} נקודות. צריך לפחות 30.` };
    }
    if (returnedToRack.length) return { ...game, message: 'בפתיחה הראשונה יש להניח רק סדרות מהאבנים שלך.' };
    return finishTurn(game, 0, nextTable, nextHand, true);
  }

  return finishTurn(game, 0, nextTable, nextHand, false);
}

// Build all melds possible from the combined rack and table, then search for
// a legal partition that keeps every table tile on the table and plays rack tiles.
// This is deliberately bounded so browser play stays responsive.
function findTableRearrangement(table, hand, difficulty = 'medium') {
  const tableTiles = table.flat();
  const combined = [...tableTiles, ...hand];
  const mandatory = new Set(tableTiles.map((tile) => tile.id));
  const melds = meldsFromHand(combined);
  const maxNodes = difficulty === 'hard' ? 120000 : difficulty === 'easy' ? 12000 : 45000;
  const candidatesById = new Map(combined.map((tile) => [tile.id, []]));
  melds.forEach((meld) => meld.forEach((tile) => candidatesById.get(tile.id)?.push(meld)));
  let nodes = 0;
  let best = null;

  const visit = (remainingMandatory, used, chosen, rackPlayed) => {
    if (++nodes > maxNodes) return;
    if (remainingMandatory.size === 0) {
      const score = rackPlayed.reduce((sum, tile) => sum + points(tile), 0);
      if (!best || score > best.score) best = { score, groups: [...chosen], played: new Set(rackPlayed.map((tile) => tile.id)) };
      return;
    }
    const targetId = [...remainingMandatory].sort((a, b) =>
      candidatesById.get(a).length - candidatesById.get(b).length
    )[0];
    for (const meld of candidatesById.get(targetId) || []) {
      if (meld.some((tile) => used.has(tile.id))) continue;
      const nextMandatory = new Set(remainingMandatory);
      meld.forEach((tile) => nextMandatory.delete(tile.id));
      const nextUsed = new Set(used);
      meld.forEach((tile) => nextUsed.add(tile.id));
      const added = meld.filter((tile) => !mandatory.has(tile.id));
      visit(nextMandatory, nextUsed, [...chosen, meld], [...rackPlayed, ...added]);
    }
  };

  visit(mandatory, new Set(), [], []);
  if (!best || best.played.size === 0) return null;
  const remainingHand = hand.filter((tile) => !best.played.has(tile.id));
  const extraMelds = bestHandMelds(remainingHand);
  const extraIds = new Set(extraMelds.flat().map((tile) => tile.id));
  return {
    ...best,
    groups: [...best.groups, ...extraMelds],
    played: new Set([...best.played, ...extraIds]),
  };
}

export function aiTurn(game) {
  if (game.finished || game.turn === 0) return game;
  const next = cloneGame(game);
  const index = next.turn;
  const player = next.players[index];
  const difficulty = next.difficulty || 'medium';

  if (!player.opened) {
    const melds = bestHandMelds(player.hand);
    const opening = melds;
    if (opening.reduce((sum, meld) => sum + meld.reduce((part, tile) => part + points(tile), 0), 0) >= 30) {
      const playedIds = new Set(opening.flat().map((tile) => tile.id));
      return finishTurn(next, index, [...next.table, ...opening], player.hand.filter((tile) => !playedIds.has(tile.id)), true);
    }
  } else {
    const rearranged = findTableRearrangement(next.table, player.hand, difficulty);
    if (rearranged) {
      return finishTurn(next, index, rearranged.groups, player.hand.filter((tile) => !rearranged.played.has(tile.id)), false);
    }
    const melds = bestHandMelds(player.hand);
    if (melds.length) {
      const playedIds = new Set(melds.flat().map((tile) => tile.id));
      return finishTurn(next, index, [...next.table, ...melds], player.hand.filter((tile) => !playedIds.has(tile.id)), false);
    }
  }

  const drawn = drawTile(next, index);
  drawn.turn = nextTurn(drawn, index);
  drawn.message = `${player.name} לא מצא/ה מהלך חוקי ולקח/ה אבן מהקופה.`;
  return drawn;
}
