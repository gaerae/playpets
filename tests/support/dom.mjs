// A small fake of the browser DOM for page tests that run in Node. It covers only what the tests
// use, and where it covers something it behaves like the browser, so a test reads like page code.
//
// - element(tag, props): a node with classList, className, dataset, style, attributes, recorded
//   listeners (dispatch() calls them), children, focus(), a dialog's showModal()/close(), and a
//   fixed layout box. Props (an id, `hidden`, `value`, a querySelector hook) replace the defaults.
// - installDom(t, options): a fake document as globalThis.document, put back when the test ends.
// - installStorage(t, storage): a fakeStorage() as globalThis.localStorage, put back the same way.
// - keepGlobals(t, ...names): puts other globals (window, Option, matchMedia) back after the test.
//
// Two things differ from the browser on purpose. remove() leaves the node where it was and marks it
// `removed`, so a test can still inspect what the page drew. Selectors are simple: matches(),
// closest() and the querySelector pair understand one `.class`, `#id`, `tag` or `[attribute]` per
// comma-separated part, and nothing else matches (so `:focus-visible` is false); a test that needs
// more replaces querySelector on the node or the document.

const ZERO_BOX = { x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };

function matchesPart(node, part) {
  if (part.startsWith('.')) return node.classList.contains(part.slice(1));
  if (part.startsWith('#')) return node.id === part.slice(1);
  const attribute = part.match(/^\[([\w-]+)\]$/)?.[1];
  if (attribute?.startsWith('data-'))
    return attribute.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase()) in node.dataset;
  if (attribute) return node.hasAttribute(attribute);
  return /^[\w-]+$/.test(part) && node.localName === part.toLowerCase();
}

function descendants(node) {
  return node.children.flatMap(child => (typeof child === 'object' ? [child, ...descendants(child)] : []));
}

/** A fake element. `rect` sets the box getBoundingClientRect reports (zero by default). */
export function element(tag = 'div', { rect, ...props } = {}) {
  const classes = new Set(),
    attributes = new Map(),
    box = { ...ZERO_BOX, ...rect };
  if (rect && !('right' in rect)) box.right = box.left + box.width;
  if (rect && !('bottom' in rect)) box.bottom = box.top + box.height;
  const node = {
    localName: tag.toLowerCase(),
    id: '',
    hidden: false,
    textContent: '',
    dataset: {},
    style: {
      setProperty(name, value) {
        this[name] = String(value);
      },
      removeProperty(name) {
        delete this[name];
      },
    },
    classList: {
      add(...names) {
        for (const name of names) classes.add(name);
      },
      remove(...names) {
        for (const name of names) classes.delete(name);
      },
      toggle(name, force = !classes.has(name)) {
        if (force) classes.add(name);
        else classes.delete(name);
        return force;
      },
      contains: name => classes.has(name),
    },
    get className() {
      return [...classes].join(' ');
    },
    set className(value) {
      classes.clear();
      for (const name of String(value).split(/\s+/)) if (name) classes.add(name);
    },
    setAttribute: (name, value) => attributes.set(name, String(value)),
    getAttribute: name => attributes.get(name) ?? null,
    removeAttribute: name => attributes.delete(name),
    hasAttribute: name => attributes.has(name),
    /** Listeners by event type, in the order they were added. */
    listeners: new Map(),
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      const list = this.listeners.get(type) || [];
      if (list.includes(listener)) list.splice(list.indexOf(listener), 1);
    },
    /**
     * Calls this node's listeners for `type` in order, as the browser does, with an event whose
     * fields `init` adds to or replaces. Returns a promise for async listeners to finish.
     */
    dispatch(type, init = {}) {
      const event = {
        type,
        target: this,
        currentTarget: this,
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
        stopPropagation() {},
        ...init,
      };
      return Promise.all([...(this.listeners.get(type) || [])].map(listener => listener(event)));
    },
    parentNode: null,
    children: [],
    append(...items) {
      for (const item of items) {
        if (typeof item === 'object') {
          item.parentNode?.children.splice(item.parentNode.children.indexOf(item), 1);
          item.parentNode = this;
        }
        this.children.push(item);
      }
    },
    insertBefore(item, before) {
      this.append(item);
      if (before) this.children.splice(this.children.indexOf(before), 0, this.children.pop());
      return item;
    },
    replaceChildren(...items) {
      for (const child of this.children.splice(0)) if (typeof child === 'object') child.parentNode = null;
      this.append(...items);
    },
    // Not the browser's: see the note at the top of this file.
    remove() {
      this.removed = true;
    },
    matches(selector) {
      return selector.split(',').some(part => matchesPart(this, part.trim()));
    },
    closest(selector) {
      for (let at = this; at; at = at.parentNode) if (at.matches?.(selector)) return at;
      return null;
    },
    contains(node) {
      for (let at = node; at; at = at.parentNode) if (at === this) return true;
      return false;
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] ?? null;
    },
    querySelectorAll(selector) {
      return descendants(this).filter(child => child.matches(selector));
    },
    getBoundingClientRect: () => ({ ...box }),
    getClientRects() {
      return this.hidden ? [] : [this.getBoundingClientRect()];
    },
    focus() {
      globalThis.document.activeElement = this;
    },
    // A <dialog>'s methods; the page calls them only on dialogs.
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
  };
  return Object.assign(node, props);
}

/** A localStorage stand-in that keeps strings, and answers null for a key it never got. */
export function fakeStorage() {
  const items = new Map();
  return { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, String(value)) };
}

// What each test has to put back, newest first, so installing twice in one test still ends with
// the globals as they were before the first.
const restores = new WeakMap();

/**
 * Remembers the named globals and returns a function that puts them back (a missing one is
 * deleted again). With a test context it also runs when the test ends; t.after hooks run in the
 * order they were added, so a cleanup that still needs the fakes is added before them.
 */
export function keepGlobals(t, ...names) {
  const saved = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  const restore = () => {
    for (const [name, descriptor] of saved)
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
  };
  if (t && !restores.has(t)) {
    const stack = [];
    restores.set(t, stack);
    t.after(() => {
      while (stack.length) stack.pop()();
    });
  }
  restores.get(t)?.push(restore);
  return restore;
}

/**
 * Sets globalThis.document to a fake whose getElementById finds the nodes listed in `ids`. With
 * `anyId`, any other id gets a node the first time it is asked for, as for tests that do not list
 * them. `props` are given to every node the document makes, `rect` included. Without a test
 * context the fake stays. Returns the document, the nodes by id, and the element maker it uses.
 */
export function installDom(t, { ids = [], anyId = false, props = {} } = {}) {
  keepGlobals(t, 'document');
  const make = (tag, extra) => element(tag, { ...props, ...extra });
  const nodes = new Map();
  const add = id => nodes.set(id, make('div', { id })).get(id);
  for (const id of ids) add(id);
  const document = element('#document', {
    body: make('body'),
    getElementById: id => nodes.get(id) ?? (anyId ? add(id) : null),
    createElement: tag => make(tag),
    createElementNS: (_namespace, tag) => make(tag),
  });
  document.append(document.body);
  document.activeElement = document.body;
  globalThis.document = document;
  return { document, nodes, element: make };
}

/** Sets globalThis.localStorage (a getter in recent Node) to `storage` until the test ends. */
export function installStorage(t, storage = fakeStorage()) {
  keepGlobals(t, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  return storage;
}
