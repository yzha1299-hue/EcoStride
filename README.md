# EcoStride

This template should help get you started developing with Vue 3 in Vite.

## App Data

Dynamic app content is loaded from JavaScript data structures in `src/data/ecostrideData.js`.
Views consume these sources through `src/composables/useJsonData.js` using keys like `home`, `events`, `clubs`, and `impact`.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### Deploy to Firebase Hosting

One-time setup:

1. Install the CLI and sign in: `npm install -g firebase-tools`, then `firebase login`.
2. In the Firebase console, enable **Authentication > Sign-in method > Google**.
3. Check **Authentication > Settings > Authorized domains** lists `ecostride-82c87.web.app`, `ecostride-82c87.firebaseapp.com` and `localhost` (Firebase adds these by default).

Each deploy:

```sh
npm run build
firebase deploy --only hosting,firestore:rules
```

The app uses HTML5 history routing, so `firebase.json` rewrites every path that is not a real file to `index.html`. Without it, opening or refreshing a deep link such as `/events` returns a 404. Hashed files under `/assets` are cached for a year; `index.html` is never cached so new deploys take effect immediately.

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
