# Qwerty Learner (personal fork)

A personal version of [Qwerty Learner](https://github.com/RealKai42/qwerty-learner), a web app for learning English vocabulary
by typing it. This fork adds flashcards with spaced repetition, a multiple-choice quiz, a matching game, your own word sets and a
new interface. The meanings in the English dictionaries are being translated into Vietnamese; the most used ones are done and the
rest are still in Chinese.

Everything runs in the browser. There is no account and no server: your progress and your sets are stored on this device only.

## Run it

You need [Node.js](https://nodejs.org/) 18 or later and [Yarn](https://yarnpkg.com/).

```bash
yarn install
yarn dev
```

Then open <http://localhost:5173>.

| Command         | What it does                            |
| --------------- | --------------------------------------- |
| `yarn dev`      | Starts the app locally with live reload |
| `yarn build`    | Builds a static site into `build/`      |
| `yarn test`     | Runs the unit tests                     |
| `yarn test:e2e` | Runs the browser tests (Playwright)     |
| `yarn lint`     | Checks the code with ESLint             |

## How to use it

### 1. Pick a set

Every study mode works on the **current set**, shown at the top of the sidebar (on a phone, at the top of the screen). Click it to
change it.

- **Library** has the built-in dictionaries (CET-4, CET-6, IELTS, TOEFL, Oxford 3000, school textbooks and more).
- **My Sets** has the sets you made yourself. _My Vocabulary_ is there from the start.

### 2. Home

The home screen shows the current set, how many cards are due today, your progress on the set (new, learning, young, mastered),
this week's activity and your streak. Start any mode from here.

### 3. Typing

Type each word as it is shown. A wrong letter resets the word, so the spelling ends up in your fingers.

- The meaning and phonetics are shown under the word, and the pronunciation plays when a word appears.
- Words are grouped in chapters; pick one in the chapter menu.
- Settings in the top bar: sound, pronunciation (US/UK), dictation mode (the word is hidden), loop a word, and more.
- Words you get wrong are saved in the **Error book** (in the _More_ menu) for review later. **Analysis** shows your typing stats.

### 4. Flashcards

A spaced repetition review, like Anki.

1. Press **Start**. You get the cards due today, then new cards (20 a day by default; change it under _New cards per day_).
2. Look at the front, try to remember, then flip the card (click it or press <kbd>Space</kbd>).
3. Grade yourself. The label under each button shows when you will see the card again.

| Button    | Key          | Use it when                                      |
| --------- | ------------ | ------------------------------------------------ |
| **Again** | <kbd>1</kbd> | You forgot. The card comes back in this session. |
| **Hard**  | <kbd>2</kbd> | You remembered with difficulty.                  |
| **Good**  | <kbd>3</kbd> | You remembered.                                  |
| **Easy**  | <kbd>4</kbd> | You knew it instantly.                           |

When everything is done the screen says **Done for today**. If you still have time:

- **+10 new / +20 new** adds more new cards for today only. Your daily setting does not change.
- **Practice** goes through cards again in a shuffled order: the ones you studied today, the ones you graded Again or Hard today,
  or the whole set. Grades in practice are not saved, so your schedule stays as it is.

Tick _Show the meaning first_ to practise the other way round (see the meaning, recall the word).

### 5. Quiz

Multiple choice: pick the right meaning of a word, or the right word for a meaning. Choose 10, 20 or all questions. Wrong answers
feed back into your flashcard schedule, so a word you miss comes up for review sooner.

### 6. Match

Match 6 words with their meanings as fast as you can. Your best time for each set is kept. A set needs at least 6 words with
different meanings.

### 7. My Sets: make your own word lists

Open **My Sets**.

- **New set**: type the words in by hand. Each word has a word, meanings (one per line), optional US/UK phonetics and an optional
  detail shown on the back of a flashcard.
- **Import a set**: drop one or more CSV or JSON files; each file becomes one set.
- **Copy a built-in dictionary**: built-in dictionaries cannot be edited, so copy one into your sets first.

In the set editor you can search the words, reorder them, and insert a new word anywhere: hover between two cards and click
**Insert**, or use **Add word** at the top or the end of the list.

**CSV format.** One word per row. A header row is optional, and the columns may come in any order when it is there:

```csv
name,trans,usphone,ukphone,detail
abandon,v. bỏ rơi; từ bỏ,əˈbændən,əˈbændən,
benefit,n. lợi ích; v. có lợi cho,ˈbenɪfɪt,ˈbenɪfɪt,"A longer note
over two lines"
```

- `name` (or `word`) and `trans` (or `meaning`) are required. Separate meanings with `;`.
- `usphone`, `ukphone` and `detail` are optional. Put a cell in double quotes if it contains commas or line breaks.

**JSON format.** The same format as the built-in dictionaries:

```json
[{ "name": "abandon", "trans": ["v. bỏ rơi", "từ bỏ"], "usphone": "əˈbændən", "ukphone": "əˈbændən" }]
```

### 8. Back up your data

Your progress lives in this browser only. Clearing the site data, or using another browser or device, starts from zero. To keep it,
open the settings in the **Typing** screen, go to the **Data** tab and use **Export Data**; **Import Data** restores a backup (it
replaces what is there).

## Credits and license

Based on [Qwerty Learner](https://github.com/RealKai42/qwerty-learner) by RealKai42 and its contributors, including the built-in
dictionaries. Licensed under the [GNU GPL v3](./LICENSE), like the original.
