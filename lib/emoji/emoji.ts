/**
 * A curated emoji set (PRD §4.49) — the few hundred people actually put in
 * notes, rather than all 3,700, so the picker stays small and the bundle
 * light. Each has a shortcode name (`:fire`) and search words.
 */

export interface Emoji {
  /** The character(s). */
  e: string;
  /** Shortcode, as typed after `:`. */
  n: string;
  /** Extra search words. */
  k: string;
}

export interface EmojiGroup {
  name: string;
  items: Emoji[];
}

const g = (name: string, rows: [string, string, string?][]): EmojiGroup => ({
  name,
  items: rows.map(([e, n, k = ""]) => ({ e, n, k })),
});

export const EMOJI_GROUPS: EmojiGroup[] = [
  g("Smileys", [
    ["😀", "grin", "happy smile"], ["😄", "smile", "happy joy"], ["😂", "joy", "laugh tears lol"],
    ["🤣", "rofl", "laugh rolling"], ["🙂", "slight_smile", "ok fine"], ["😉", "wink"], ["😊", "blush", "happy"],
    ["😍", "heart_eyes", "love"], ["🥰", "smiling_hearts", "love"], ["😘", "kiss"], ["😎", "cool", "sunglasses"],
    ["🤓", "nerd", "geek"], ["🤔", "thinking", "hmm think"], ["🤨", "raised_eyebrow", "skeptical"], ["😐", "neutral"],
    ["😑", "expressionless"], ["🙄", "eye_roll", "whatever"], ["😏", "smirk"], ["😬", "grimace", "awkward"],
    ["😅", "sweat_smile", "phew"], ["😌", "relieved"], ["😴", "sleeping", "tired zzz"], ["🥱", "yawn", "bored tired"],
    ["😷", "mask", "sick"], ["🤒", "sick", "ill fever"], ["🤯", "mind_blown", "exploding"], ["🥳", "party", "celebrate"],
    ["😢", "cry", "sad tear"], ["😭", "sob", "crying sad"], ["😤", "triumph", "huff"], ["😡", "angry", "mad rage"],
    ["😱", "scream", "shock fear"], ["😳", "flushed", "embarrassed"], ["🥺", "pleading", "please"], ["😇", "innocent", "angel"],
    ["🤗", "hug"], ["🤫", "shush", "quiet secret"], ["🫠", "melting"], ["🤐", "zipper", "secret"], ["🤡", "clown"],
    ["👻", "ghost"], ["💀", "skull", "dead"], ["🤖", "robot", "bot ai"], ["👽", "alien"], ["💩", "poop"],
  ]),
  g("Gestures", [
    ["👍", "thumbsup", "yes ok good +1"], ["👎", "thumbsdown", "no bad -1"], ["👌", "ok_hand", "perfect"],
    ["✌️", "v", "peace victory"], ["🤞", "crossed_fingers", "luck hope"], ["🤙", "call_me", "shaka"],
    ["👏", "clap", "applause bravo"], ["🙌", "raised_hands", "hooray"], ["🙏", "pray", "please thanks"],
    ["🤝", "handshake", "deal agree"], ["💪", "muscle", "strong flex"], ["👋", "wave", "hello bye hi"],
    ["✍️", "writing", "write"], ["👉", "point_right"], ["👈", "point_left"], ["👆", "point_up"], ["👇", "point_down"],
    ["☝️", "index_up", "one"], ["🫡", "salute"], ["🤷", "shrug", "dunno"], ["🤦", "facepalm"], ["🙋", "raising_hand", "question"],
    ["👀", "eyes", "look see watch"], ["🧠", "brain", "think smart"], ["❤️", "heart", "love red"], ["💔", "broken_heart"],
    ["💙", "blue_heart"], ["💚", "green_heart"], ["💜", "purple_heart"], ["🧡", "orange_heart"], ["💛", "yellow_heart"],
  ]),
  g("Marks", [
    ["✅", "check", "done yes tick white_check_mark"], ["☑️", "ballot_check", "done"], ["✔️", "heavy_check", "done"],
    ["❌", "x", "no wrong cross fail"], ["❎", "x_box", "no"], ["⚠️", "warning", "caution alert"], ["⛔", "no_entry", "stop"],
    ["🚫", "prohibited", "forbidden no"], ["❓", "question", "ask what"], ["❔", "grey_question"], ["❗", "exclamation", "important bang"],
    ["‼️", "bangbang", "important"], ["⁉️", "interrobang"], ["💯", "100", "perfect score"], ["⭐", "star", "favourite"],
    ["🌟", "glowing_star", "shine"], ["✨", "sparkles", "new shiny magic"], ["🔥", "fire", "hot lit"], ["💡", "bulb", "idea light"],
    ["📌", "pin", "pushpin important"], ["📍", "round_pin", "location"], ["🔖", "bookmark"], ["🏷️", "label", "tag"],
    ["🎯", "target", "goal dart bullseye"], ["🚩", "red_flag", "flag warning"], ["🏁", "finish", "chequered done"],
    ["🔴", "red_circle", "red dot"], ["🟠", "orange_circle"], ["🟡", "yellow_circle"], ["🟢", "green_circle", "go"],
    ["🔵", "blue_circle"], ["🟣", "purple_circle"], ["⚫", "black_circle"], ["⚪", "white_circle"],
    ["➡️", "arrow_right", "next"], ["⬅️", "arrow_left", "back"], ["⬆️", "arrow_up"], ["⬇️", "arrow_down"],
    ["🔁", "repeat", "loop again"], ["🔄", "refresh", "sync"], ["➕", "plus", "add"], ["➖", "minus"], ["♻️", "recycle"],
  ]),
  g("Work", [
    ["📝", "memo", "note write"], ["📄", "page", "document doc"], ["📋", "clipboard", "list"], ["📁", "folder"],
    ["📂", "open_folder"], ["🗂️", "dividers", "organise"], ["📅", "calendar", "date"], ["🗓️", "spiral_calendar", "schedule"],
    ["⏰", "alarm", "time deadline"], ["⏳", "hourglass", "waiting time"], ["⌛", "hourglass_done"], ["🕐", "clock", "time"],
    ["📈", "chart_up", "growth increase"], ["📉", "chart_down", "decrease"], ["📊", "bar_chart", "stats"],
    ["💼", "briefcase", "work job"], ["🏢", "office", "company building"], ["💰", "money_bag", "money"], ["💵", "dollar", "money cash"],
    ["💳", "card", "credit payment"], ["🧾", "receipt"], ["✉️", "envelope", "email mail"], ["📧", "email", "mail"],
    ["📞", "phone", "call"], ["📱", "mobile", "phone iphone"], ["💻", "laptop", "computer"], ["🖥️", "desktop", "computer"],
    ["⌨️", "keyboard"], ["🖱️", "mouse"], ["🐛", "bug", "issue defect"], ["🔧", "wrench", "fix tool"], ["🛠️", "tools", "build"],
    ["⚙️", "gear", "settings config"], ["🔒", "lock", "secure private"], ["🔓", "unlock"], ["🔑", "key", "password"],
    ["🔍", "search", "find magnify"], ["🔗", "link", "chain url"], ["📎", "paperclip", "attach"], ["✂️", "scissors", "cut"],
    ["🧪", "test", "experiment"], ["📦", "package", "box ship"], ["🚀", "rocket", "launch ship fast"], ["🎉", "tada", "celebrate party"],
    ["🏆", "trophy", "win award"], ["🥇", "first", "gold medal"], ["📚", "books", "study read"], ["📖", "book", "read"],
    ["🎓", "graduate", "study school"], ["✏️", "pencil", "edit"], ["🖊️", "pen"], ["🗑️", "wastebasket", "trash delete"],
  ]),
  g("Life", [
    ["☕", "coffee", "tea break"], ["🍵", "tea"], ["🍺", "beer", "drink"], ["🍷", "wine"], ["🍕", "pizza", "food"],
    ["🍔", "burger", "food"], ["🍜", "noodles", "ramen"], ["🍰", "cake", "birthday"], ["🍎", "apple", "fruit"],
    ["🥑", "avocado"], ["🏠", "home", "house"], ["🛒", "cart", "shopping groceries"], ["✈️", "airplane", "travel flight"],
    ["🚗", "car", "drive"], ["🚲", "bike", "cycle"], ["🏃", "running", "run exercise"], ["🏋️", "gym", "lift exercise"],
    ["🧘", "yoga", "meditate calm"], ["🎵", "music", "note song"], ["🎧", "headphones", "listen"], ["🎮", "game", "play"],
    ["📷", "camera", "photo"], ["🎬", "movie", "film"], ["🎁", "gift", "present"], ["🎂", "birthday", "cake"],
    ["💊", "pill", "medicine"], ["🏥", "hospital"], ["🐶", "dog", "puppy"], ["🐱", "cat", "kitten"], ["🌱", "seedling", "grow plant"],
    ["🌳", "tree"], ["🌸", "blossom", "flower"], ["🌍", "earth", "world globe"], ["☀️", "sun", "sunny"], ["🌙", "moon", "night"],
    ["⛅", "cloudy", "weather"], ["🌧️", "rain", "weather"], ["❄️", "snow", "cold"], ["⚡", "zap", "lightning fast"], ["🌈", "rainbow"],
  ]),
];

export const ALL_EMOJI: Emoji[] = EMOJI_GROUPS.flatMap((group) => group.items);

/** Emoji matching a query: shortcode prefix first, then shortcode or word anywhere. */
export function searchEmoji(query: string, limit = 24): Emoji[] {
  const q = query.toLowerCase().replace(/^:/, "");
  if (!q) return ALL_EMOJI.slice(0, limit);
  const starts: Emoji[] = [];
  const words: Emoji[] = [];
  for (const emoji of ALL_EMOJI) {
    if (emoji.n.startsWith(q)) starts.push(emoji);
    else if (emoji.n.includes(q) || emoji.k.split(" ").some((w) => w.startsWith(q))) words.push(emoji);
  }
  return [...starts, ...words].slice(0, limit);
}

/** The shortcode being typed before the caret: `:` after a space or line start, then 2+ characters. */
export function emojiQuery(textBeforeCaret: string): { offset: number; query: string } | null {
  const match = /(?:^|[\s(])(:([a-z0-9_+-]{2,}))$/i.exec(textBeforeCaret);
  if (!match) return null;
  return { offset: textBeforeCaret.length - match[1]!.length, query: match[2]!.toLowerCase() };
}
