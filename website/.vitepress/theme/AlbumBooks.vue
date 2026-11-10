<!-- The album's books on the landing: each with three of its kinds as the app draws them, how many it
     holds and how to fill it. The books and their counts are the app's (ALBUM_BOOKS). -->
<script setup lang="ts">
import catalog from '../../../src/content/catalog.json';
import { ALBUM_BOOKS } from '../../../src/yard/catalog.js';
import { ALBUM_SAMPLES } from '../../../scripts/site-content.mjs';
import { bookName, kindArt, kindName } from './album-art';

const props = defineProps<{ lang: string; copy: { books: Record<string, string> } }>();
const books = ALBUM_BOOKS.map(book => ({ book, count: catalog[book].length, samples: ALBUM_SAMPLES[book] }));
</script>

<template>
  <ul class="album-books">
    <li v-for="{ book, count, samples } in books" :key="book" :class="`book-${book}`">
      <div class="book-art">
        <template v-for="id in samples" :key="id">
          <img v-if="kindArt(book, id)" v-bind="kindArt(book, id)" :alt="kindName(props.lang, book, id)" :title="kindName(props.lang, book, id)" loading="lazy" decoding="async" />
        </template>
      </div>
      <h3>{{ bookName(props.lang, book) }} <span class="book-count">{{ count }}</span></h3>
      <p>{{ props.copy.books[book] }}</p>
    </li>
  </ul>
</template>
