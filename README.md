# PocketBase JavaScript SDK

Official JavaScript SDK (browser and node) for interacting with the [PocketBase API](https://pocketbase.io/docs).

## Installation

### Browser (manually via script tag)

```html
<script src="/path/to/dist/pocketbase.umd.js"></script>
<script type="text/javascript">
    const pb = new PocketBase("https://example.com")
    ...
</script>
```

_OR if you are using ES modules:_
```html
<script type="module">
    import PocketBase from '/path/to/dist/pocketbase.es.mjs'

    const pb = new PocketBase("https://example.com")
    ...
</script>
```

### Node.js (via npm)

```sh
npm install pocketbase --save
```

```js
// Using ES modules (default)
import PocketBase from 'pocketbase'

// OR if you are using CommonJS modules
const PocketBase = require('pocketbase/cjs')
```

> 🔧 For **Node < 17** you'll need to load a `fetch()` polyfill.
> I recommend [lquixada/cross-fetch](https://github.com/lquixada/cross-fetch):
> ```js
> // npm install cross-fetch --save
> import 'cross-fetch/polyfill';
> ```

> 🔧 Node doesn't have native `EventSource` implementation, so in order to use the realtime subscriptions you'll need to load a `EventSource` polyfill.
> ```js
> // for server: npm install eventsource --save
> import { EventSource } from "eventsource";
>
> // for React Native: npm install react-native-sse --save
> import EventSource from "react-native-sse";
>
> global.EventSource = EventSource;
> ```

## Usage

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

// authenticate as auth collection record
const userData = await pb.collection('users').authWithPassword('test@example.com', '123456');

// list and filter "example" collection records
const result = await pb.collection('example').getList(1, 20, {
    filter: 'status = true && created > "2022-08-01 10:00:00"'
});

// and much more...
```

## Svelte / SvelteKit Integration

The SDK provides first-class Svelte support with reactive stores.

### Quick Start

```typescript
// lib/pocketbase.ts
import { createPocketBase } from 'pocketbase/svelte';

export const { pb, user, authState } = createPocketBase('http://127.0.0.1:8090');
```

```svelte
<script>
  import { pb, user } from '$lib/pocketbase';

  async function login(email, password) {
    await pb.collection('users').authWithPassword(email, password);
    // $user automatically updates!
  }
</script>

{#if $user}
  <p>Welcome, {$user.email}</p>
  <button on:click={() => pb.authStore.clear()}>Logout</button>
{:else}
  <button on:click={() => login('test@example.com', '123456')}>Login</button>
{/if}
```

### Svelte Reactive Stores

#### Using `pb.authStore` directly

The `authStore` implements Svelte's store contract, so you can use it with the `$` prefix:

```svelte
<script>
  import { pb } from '$lib/pocketbase';
</script>

{#if $pb.authStore.isValid}
  <p>Token: {$pb.authStore.token}</p>
  <p>User: {$pb.authStore.record?.email}</p>
{/if}
```

#### Realtime Collection Store

Subscribe to collection changes with automatic cleanup:

```svelte
<script>
  import { pb } from '$lib/pocketbase';
  import { realtimeStore } from 'pocketbase/svelte';

  // Automatically fetches initial data and subscribes to changes
  const posts = realtimeStore(pb, 'posts', {
    sort: '-created',
    filter: 'published = true',
  });
</script>

{#each $posts as post (post.id)}
  <article>
    <h2>{post.title}</h2>
    <p>{post.content}</p>
  </article>
{/each}
```

#### Realtime Single Record Store

Watch a single record for changes:

```svelte
<script>
  import { pb } from '$lib/pocketbase';
  import { realtimeRecord } from 'pocketbase/svelte';
  import { page } from '$app/stores';

  $: post = realtimeRecord(pb, 'posts', $page.params.id);
</script>

{#if $post}
  <h1>{$post.title}</h1>
  <p>{$post.content}</p>
{:else}
  <p>Loading...</p>
{/if}
```

### SvelteKit SSR Integration

```typescript
// src/hooks.server.ts
import PocketBase from 'pocketbase';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.pb = new PocketBase('http://127.0.0.1:8090');

  // Load auth from cookie
  event.locals.pb.authStore.loadFromCookie(event.request.headers.get('cookie') || '');

  try {
    // Refresh auth if valid
    if (event.locals.pb.authStore.isValid) {
      await event.locals.pb.collection('users').authRefresh();
    }
  } catch (_) {
    event.locals.pb.authStore.clear();
  }

  const response = await resolve(event);

  // Send updated cookie
  response.headers.append('set-cookie', event.locals.pb.authStore.exportToCookie());

  return response;
};
```

```typescript
// src/app.d.ts
import type PocketBase from 'pocketbase';

declare global {
  namespace App {
    interface Locals {
      pb: PocketBase;
    }
  }
}

export {};
```

---

## API Overview

### Creating a Client Instance

```js
const pb = new PocketBase(baseURL = '/', authStore = LocalAuthStore);
```

### Instance Methods

| Method                            | Description                                                                   |
|:----------------------------------|:------------------------------------------------------------------------------|
| `pb.send(path, sendOptions = {})` | Sends an api http request.                                                    |
| `pb.autoCancellation(enable)`     | Globally enable or disable auto cancellation for pending duplicated requests. |
| `pb.cancelAllRequests()`          | Cancels all pending requests.                                                 |
| `pb.cancelRequest(cancelKey)`     | Cancels single request by its cancellation token key.                         |
| `pb.buildURL(path)`               | Builds a full client url by safely concatenating the provided path.           |
| `pb.filter(expr, params)`         | Generates a filter string with bound parameters.                              |

### Services

#### RecordService

```js
// CRUD operations
pb.collection(collectionIdOrName).getList(page, perPage, options);
pb.collection(collectionIdOrName).getFullList(options);
pb.collection(collectionIdOrName).getFirstListItem(filter, options);
pb.collection(collectionIdOrName).getOne(recordId, options);
pb.collection(collectionIdOrName).create(bodyParams, options);
pb.collection(collectionIdOrName).update(recordId, bodyParams, options);
pb.collection(collectionIdOrName).delete(recordId, options);

// Realtime
pb.collection(collectionIdOrName).subscribe(topic, callback, options);
pb.collection(collectionIdOrName).unsubscribe(topic);

// Auth (for "auth" type collections)
pb.collection(collectionIdOrName).listAuthMethods(options);
pb.collection(collectionIdOrName).authWithPassword(usernameOrEmail, password, options);
pb.collection(collectionIdOrName).authWithOTP(otpId, password, options);
pb.collection(collectionIdOrName).authWithOAuth2(authConfig);
pb.collection(collectionIdOrName).authRefresh(options);
pb.collection(collectionIdOrName).requestOTP(email, options);
pb.collection(collectionIdOrName).requestPasswordReset(email, options);
pb.collection(collectionIdOrName).confirmPasswordReset(resetToken, newPassword, newPasswordConfirm, options);
pb.collection(collectionIdOrName).requestVerification(email, options);
pb.collection(collectionIdOrName).confirmVerification(verificationToken, options);
pb.collection(collectionIdOrName).requestEmailChange(newEmail, options);
pb.collection(collectionIdOrName).confirmEmailChange(emailChangeToken, userPassword, options);
```

#### BatchService

```js
const batch = pb.createBatch();
batch.collection('example1').create({ ... });
batch.collection('example2').update('RECORD_ID', { ... });
batch.collection('example3').delete('RECORD_ID');
const result = await batch.send();
```

#### FileService

```js
pb.files.getURL(record, filename, options);
pb.files.getToken(options);
```

#### CollectionService

```js
pb.collections.getList(page, perPage, options);
pb.collections.getFullList(options);
pb.collections.getOne(idOrName, options);
pb.collections.create(bodyParams, options);
pb.collections.update(idOrName, bodyParams, options);
pb.collections.delete(idOrName, options);
pb.collections.truncate(idOrName, options);
pb.collections.import(collections, deleteMissing, options);
```

#### Other Services

```js
// Logs
pb.logs.getList(page, perPage, options);
pb.logs.getOne(id, options);
pb.logs.getStats(options);

// Settings
pb.settings.getAll(options);
pb.settings.update(bodyParams, options);
pb.settings.testS3(filesystem, options);
pb.settings.testEmail(collectionIdOrName, toEmail, template, options);

// Backups
pb.backups.getFullList(options);
pb.backups.create(basename, options);
pb.backups.upload({ file: File }, options);
pb.backups.delete(key, options);
pb.backups.restore(key, options);

// Crons
pb.crons.getFullList(options);
pb.crons.run(jobId, options);

// Health
pb.health.check(options);
```

### Auth Store

The SDK keeps track of the authenticated token and auth model via `pb.authStore`:

```js
pb.authStore.token;       // the authenticated token
pb.authStore.record;      // the authenticated record model
pb.authStore.isValid;     // checks if the token is valid and not expired
pb.authStore.isSuperuser; // checks if the authenticated user is a superuser

pb.authStore.save(token, record);
pb.authStore.clear();
pb.authStore.onChange(callback, fireImmediately);

// Cookie helpers
pb.authStore.loadFromCookie(cookieHeader, key);
pb.authStore.exportToCookie(options, key);
```

### Filter Parameters

Use `pb.filter()` to safely bind parameters in filter expressions:

```js
const records = await pb.collection("example").getList(1, 20, {
    filter: pb.filter("title ~ {:title} && total = {:num}", { 
        title: "te'st", 
        num: 123 
    })
});
```

### TypeScript Support

```ts
interface Task {
    id: string;
    name: string;
}

pb.collection('tasks').getList<Task>(1, 20);
pb.collection('tasks').getOne<Task>("RECORD_ID");
```

## Development

```sh
# Install dependencies
npm install

# Run tests
npm test

# Build for production
npm run build

# Format code
npm run format
```

## License

MIT
# 1stack
