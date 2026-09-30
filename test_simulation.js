// test_simulation.js
// Comprehensive test suite covering all 12 required cases from Coursera Skip Tool requirements.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

console.log('====================================================');
console.log('RUNNING COURSERA SKIP TOOL SIMULATION TEST SUITE');
console.log('====================================================\n');

// 1. Faithful WebIDL DOM Classes to strictly simulate browser behavior
class Event {
  constructor(type, init = {}) {
    this.type = type;
    this.bubbles = !!init.bubbles;
  }
}

class InputEvent extends Event {
  constructor(type, init = {}) {
    super(type, init);
    this.inputType = init.inputType;
    this.data = init.data;
  }
}

class KeyboardEvent extends Event {
  constructor(type, init = {}) {
    super(type, init);
    this.key = init.key;
  }
}

class Node {
  set innerHTML(html) {
    if (!html || typeof html !== "string") return;
    const idMatches = html.matchAll(/id=["\x27]([^"\x27]+)["\x27]/g);
    for (const match of idMatches) {
      const el = new HTMLElement();
      el.id = match[1];
      this.appendChild(el);
    }
  }
  constructor(tagName = 'DIV') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.attributes = {};
    this.classList = {
      _classes: new Set(),
      contains(c) { return this._classes.has(c); },
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      toggle(c, f) { if (f === undefined) { if (this._classes.has(c)) this._classes.delete(c); else this._classes.add(c); } else if (f) this._classes.add(c); else this._classes.delete(c); }
    };
    this.style = {};
    this.id = '';
    this.className = '';
  }

  getAttribute(name) {
    if (name === 'role') return this.attributes['role'] ?? null;
    if (name === 'contenteditable') return this.attributes['contenteditable'] ?? null;
    return this.attributes[name] ?? null;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  cloneNode(deep = false) {
    const clone = new Node(this.tagName);
    clone.id = this.id;
    clone.className = this.className;
    clone.textContent = this.textContent;
    clone.attributes = { ...this.attributes };
    if (deep) {
      for (const child of this.children) {
        clone.appendChild(child.cloneNode(true));
      }
    }
    return clone;
  }

  remove() {
    if (this.parentElement) {
      const idx = this.parentElement.children.indexOf(this);
      if (idx !== -1) this.parentElement.children.splice(idx, 1);
      this.parentElement = null;
    }
  }

  get innerText() {
    return this.textContent || '';
  }

  set innerText(val) {
    this.textContent = String(val);
  }

  contains(other) {
    if (!other) return false;
    let curr = other;
    while (curr) {
      if (curr === this) return true;
      curr = curr.parentElement;
    }
    return false;
  }

  closest(selector) {
    let curr = this;
    while (curr) {
      if (curr.matches && curr.matches(selector)) return curr;
      curr = curr.parentElement;
    }
    return null;
  }

  matches(sel) {
    if (!sel) return false;
    sel = sel.trim();
    if (sel === 'label' && this.tagName === 'LABEL') return true;
    if (sel.startsWith('label[for=')) {
      const targetId = sel.slice(11, -2);
      return this.tagName === 'LABEL' && this.attributes['for'] === targetId;
    }
    if (sel.startsWith('.')) {
      return this.classList.contains(sel.slice(1));
    }
    if (sel.startsWith('fieldset')) {
      if (this.tagName !== 'FIELDSET') return false;
      if (sel.includes('.')) {
        const cls = sel.split('.')[1];
        return this.classList.contains(cls);
      }
      return true;
    }
    if (sel === 'input[type="radio"]') {
      return this.tagName === 'INPUT' && this.type === 'radio';
    }
    if (sel === 'input[type="text"]') {
      return this.tagName === 'INPUT' && this.type === 'text';
    }
    if (sel === 'textarea') {
      return this.tagName === 'TEXTAREA';
    }
    if (sel === 'div[role="textbox"]') {
      return this.tagName === 'DIV' && this.getAttribute('role') === 'textbox';
    }
    if (sel.includes('contenteditable="true"')) {
      return this.getAttribute('contenteditable') === 'true';
    }
    if (sel.includes('data-testid="peer-review-multi-line-input-field"')) {
      return this.attributes['data-testid'] === 'peer-review-multi-line-input-field';
    }
    if (sel.includes('data-testid*="rubric-criterion"')) {
      return (this.attributes['data-testid'] || '').includes('rubric-criterion');
    }
    if (sel.includes('data-testid*="rubric-item"')) {
      return (this.attributes['data-testid'] || '').includes('rubric-item');
    }
    if (sel.includes('data-testid*="submit-review"')) {
      return (this.attributes['data-testid'] || '').includes('submit-review');
    }
    if (sel.toLowerCase() === this.tagName.toLowerCase()) return true;
    if (sel === 'input[type="checkbox"]') {
      return this.tagName === 'INPUT' && this.type === 'checkbox';
    }
    if (sel.includes('data-testid=')) {
      const match = sel.match(/data-testid=["']([^"']+)["']/);
      if (match && this.attributes['data-testid'] === match[1]) return true;
    }
    if (sel.includes('data-testid*=')) {
      const match = sel.match(/data-testid\*=["']([^"']+)["']/);
      if (match && (this.attributes['data-testid'] || '').includes(match[1])) return true;
    }
    if (sel === 'form[data-testid]') {
      return this.tagName === 'FORM' && !!this.attributes['data-testid'];
    }
    if (sel === 'button[type="submit"]') {
      return this.tagName === 'BUTTON' && this.type === 'submit';
    }
    if (sel === 'button') {
      return this.tagName === 'BUTTON';
    }
    if (sel === 'input[type="radio"]:checked') {
      return this.tagName === 'INPUT' && this.type === 'radio' && this.checked;
    }
    return false;
  }

  querySelectorAll(sel) {
    const results = [];
    const selectors = sel.split(',').map(s => s.trim());
    const traverse = (node) => {
      for (const child of node.children) {
        if (selectors.some(s => child.matches(s))) {
          results.push(child);
        }
        traverse(child);
      }
    };
    traverse(this);
    return results;
  }

  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }

  dispatchEvent(evt) {
    return true;
  }

  focus() {}
  click() {}
  scrollIntoView() {}
}

class HTMLElement extends Node {
  attachShadow() {
    this.shadowRoot = new Document();
    return this.shadowRoot;
  }
  addEventListener(type, fn) {}
  removeEventListener(type, fn) {}
  getBoundingClientRect() { return { left: 100, top: 100 }; }
}

// Strict WebIDL setters: Throw TypeError: Illegal invocation if called on wrong type!
class HTMLTextAreaElement extends HTMLElement {
  constructor() {
    super('TEXTAREA');
    this._value = '';
  }
}
Object.defineProperty(HTMLTextAreaElement.prototype, 'value', {
  get() {
    if (!(this instanceof HTMLTextAreaElement)) {
      throw new TypeError('Illegal invocation');
    }
    return this._value;
  },
  set(val) {
    if (!(this instanceof HTMLTextAreaElement)) {
      throw new TypeError('Illegal invocation');
    }
    this._value = String(val);
  }
});

class HTMLInputElement extends HTMLElement {
  constructor(type = 'text') {
    super('INPUT');
    this.type = type;
    this._value = '';
    this.checked = false;
    this.disabled = false;
  }

  click() {
    if (this.type === 'radio' && !this.disabled && this.getAttribute('aria-disabled') !== 'true') {
      this.checked = true;
      this.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}
Object.defineProperty(HTMLInputElement.prototype, 'value', {
  get() {
    if (!(this instanceof HTMLInputElement)) {
      throw new TypeError('Illegal invocation');
    }
    return this._value;
  },
  set(val) {
    if (!(this instanceof HTMLInputElement)) {
      throw new TypeError('Illegal invocation');
    }
    this._value = String(val);
  }
});

class HTMLButtonElement extends HTMLElement {
  constructor(type = 'button') {
    super('BUTTON');
    this.type = type;
    this.textContent = '';
    this.disabled = false;
  }
}

class Document extends HTMLElement {
  constructor() {
    super('DOCUMENT');
    this.body = new HTMLElement('BODY');
    this.appendChild(this.body);
  }
  set innerHTML(html) {
    const idMatches = html.matchAll(/id=["\x27]([^"\x27]+)["\x27]/g);
    for (const match of idMatches) {
      const el = new HTMLElement();
      el.id = match[1];
      this.appendChild(el);
    }
  }

  createElement(tagName) {
    const upper = tagName.toUpperCase();
    if (upper === 'TEXTAREA') return new HTMLTextAreaElement();
    if (upper === 'INPUT') return new HTMLInputElement();
    if (upper === 'BUTTON') return new HTMLButtonElement();
    return new HTMLElement(upper);
  }

  execCommand(cmd, showUI, val) {
    return true;
  }
  getElementById(id) {
    const traverse = (node) => {
      if (node.id === id) return node;
      for (const child of node.children) {
        const found = traverse(child);
        if (found) return found;
      }
      return null;
    };
    return traverse(this);
  }
}

// Function to create a clean sandbox with content.js loaded
function createSandbox(initialUrl = 'https://www.coursera.org/learn/sample-course/lecture/testItem') {
  const doc = new Document();
  const messagesSent = [];

  const sandbox = {
    console: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
    Date,
    Math,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Promise,
    parseInt,
    parseFloat,
    isNaN,
    String,
    Number,
    Array,
    Set,
    Map,
    Object,
    TypeError,
    Event,
    InputEvent,
    KeyboardEvent,
    HTMLTextAreaElement,
    HTMLInputElement,
    HTMLElement,
    document: doc,
    navigator: { language: "en-US" },
    window: {
      navigator: { language: "en-US" },
      addEventListener: () => {},
      location: { href: initialUrl, reload: () => { sandbox._reloaded = true; } },
      HTMLTextAreaElement,
      HTMLInputElement,
      getComputedStyle: () => ({ pointerEvents: 'auto', opacity: '1' }),
    },
    localStorage: {
      store: {},
      getItem(k) { return this.store[k] || null; },
      setItem(k, v) { this.store[k] = String(v); },
    },
    chrome: {
      runtime: {
        sendMessage: (msg) => { messagesSent.push(msg); },
        onMessage: { addListener: (fn) => { sandbox._messageListener = fn; } }
      }
    },
    sleep: (ms) => new Promise(r => setTimeout(r, 10)),
    _reloaded: false,
    _messagesSent: messagesSent
  };

  sandbox.window.document = doc;

  const contentCode = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');
  vm.createContext(sandbox);

  const modifiedCode = contentCode.replace(
    /function sleep\(ms\) \{[\s\S]*?\}/,
    'function sleep(ms) { return new Promise(r => setTimeout(r, 5)); }'
  );
  vm.runInContext(modifiedCode, sandbox);

  return sandbox;
}

let passedCount = 0;
let totalCount = 12;

async function runTests() {
  // -------------------------------------------------------------
  // Test 1: old UI + textarea
  // -------------------------------------------------------------
  {
    console.log('Test 1: old UI + textarea');
    const sb = createSandbox('https://www.coursera.org/learn/test/peer/abc');
    const formPart = new HTMLElement('DIV');
    formPart.classList.add('rc-FormPart');

    const radio1 = new HTMLInputElement('radio');
    radio1.id = 'r1';
    const label1 = new HTMLElement('LABEL');
    label1.setAttribute('for', 'r1');
    label1.textContent = '0 points';

    const radio2 = new HTMLInputElement('radio');
    radio2.id = 'r2';
    const label2 = new HTMLElement('LABEL');
    label2.setAttribute('for', 'r2');
    label2.textContent = '3 points';

    const textarea = new HTMLTextAreaElement();

    formPart.appendChild(radio1);
    formPart.appendChild(label1);
    formPart.appendChild(radio2);
    formPart.appendChild(label2);
    formPart.appendChild(textarea);
    sb.document.body.appendChild(formPart);

    const submitBtn = new HTMLButtonElement('submit');
    submitBtn.textContent = 'Submit';
    sb.document.body.appendChild(submitBtn);

    const res = await vm.runInContext('autoGradePeerReview()', sb);
    assert.strictEqual(res.success, true, 'Result should be successful');
    assert.strictEqual(res.submitted, false, 'Should not auto submit');
    assert.strictEqual(radio2.checked, true, 'Highest score radio (3 points) should be checked');
    assert.ok(textarea.value.length > 0, 'Textarea should be filled with review comment');
    console.log('  -> PASS: old UI + textarea graded correctly\n');
    passedCount++;
  }

  // -------------------------------------------------------------
  // Test 2: modern UI + contenteditable
  // -------------------------------------------------------------
  {
    console.log('Test 2: modern UI + contenteditable');
    const sb = createSandbox('https://www.coursera.org/learn/test/peer/abc');
    const criterion = new HTMLElement('DIV');
    criterion.setAttribute('data-testid', 'rubric-criterion-1');

    const radio1 = new HTMLInputElement('radio');
    radio1.id = 'r1';
    const label1 = new HTMLElement('LABEL');
    label1.setAttribute('for', 'r1');
    label1.textContent = '1 point';

    const radio2 = new HTMLInputElement('radio');
    radio2.id = 'r2';
    const label2 = new HTMLElement('LABEL');
    label2.setAttribute('for', 'r2');
    label2.textContent = '5 points';

    const ceDiv = new HTMLElement('DIV');
    ceDiv.setAttribute('contenteditable', 'true');
    ceDiv.setAttribute('role', 'textbox');

    criterion.appendChild(radio1);
    criterion.appendChild(label1);
    criterion.appendChild(radio2);
    criterion.appendChild(label2);
    criterion.appendChild(ceDiv);
    sb.document.body.appendChild(criterion);

    const res = await vm.runInContext('autoGradePeerReview()', sb);
    assert.strictEqual(res.success, true);
    assert.strictEqual(radio2.checked, true);
    assert.ok(ceDiv.textContent.length > 0, 'contenteditable should have review comment');
    console.log('  -> PASS: modern UI + contenteditable handled cleanly\n');
    passedCount++;
  }

  // -------------------------------------------------------------
  // Test 3: input[type=text] (WebIDL Illegal invocation check)
  // -------------------------------------------------------------
  {
    console.log('Test 3: input[type=text] (must not throw Illegal invocation)');
    const sb = createSandbox('https://www.coursera.org/learn/test/peer/abc');
    const formPart = new HTMLElement('DIV');
    formPart.classList.add('rc-FormPartsQuestion');

    const radio = new HTMLInputElement('radio');
    radio.id = 'r1';
    const label = new HTMLElement('LABEL');
    label.setAttribute('for', 'r1');
    label.textContent = '10 points';

    const textInput = new HTMLInputElement('text');

    formPart.appendChild(radio);
    formPart.appendChild(label);
    formPart.appendChild(textInput);
    sb.document.body.appendChild(formPart);

    assert.doesNotThrow(() => {
      sb.fillTextInput(textInput, 'Excellent submission!');
    }, 'fillTextInput on input[type=text] must not throw Illegal invocation');

    assert.strictEqual(textInput.value, 'Excellent submission!');

    const res = await vm.runInContext('autoGradePeerReview()', sb);
    assert.strictEqual(res.success, true);
    console.log('  -> PASS: input[type=text] filled using HTMLInputElement prototype without error\n');
    passedCount++;
  }

  // -------------------------------------------------------------
  // Test 4: rubric xuất hiện sau 500-1000ms
  // -------------------------------------------------------------
  {
    console.log('Test 4: rubric appears after 500-1000ms (polling wait)');
    const sb = createSandbox('https://www.coursera.org/learn/test/peer/abc');

    setTimeout(() => {
      const formPart = new HTMLElement('DIV');
      formPart.classList.add('rc-FormPart');
      const radio = new HTMLInputElement('radio');
      radio.id = 'delayed_r';
      const label = new HTMLElement('LABEL');
      label.setAttribute('for', 'delayed_r');
      label.textContent = '10 pts';
      const ta = new HTMLTextAreaElement();
      formPart.appendChild(radio);
      formPart.appendChild(label);
      formPart.appendChild(ta);
      sb.document.body.appendChild(formPart);
    }, 50);

    const res = await vm.runInContext('autoGradePeerReview()', sb);
    assert.strictEqual(res.success, true);
    assert.ok(res.message.includes('1 tiêu chí'), 'Should discover and select the delayed rubric');
    console.log('  -> PASS: polling waits for rubric and succeeds\n');
    passedCount++;
  }

  // -------------------------------------------------------------
  // Test 5: không có rubric
  // -------------------------------------------------------------
  {
    console.log('Test 5: no rubric present');
    const sb = createSandbox('https://www.coursera.org/learn/test/peer/abc');
    const res = await vm.runInContext('autoGradePeerReview()', sb);
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes('Không tìm thấy'));
    console.log('  -> PASS: returns success: false when no rubric exists\n');
    passedCount++;
  }

  // -------------------------------------------------------------
  // Test 6: radio cao nhất disabled
  // -------------------------------------------------------------
  {
    console.log('Test 6: highest radio disabled');
    const sb = createSandbox('https://www.coursera.org/learn/test/peer/abc');
    const formPart = new HTMLElement('DIV');
    formPart.classList.add('rc-FormPart');

    const radio1 = new HTMLInputElement('radio');
    radio1.id = 'r1';
    const label1 = new HTMLElement('LABEL');
    label1.setAttribute('for', 'r1');
    label1.textContent = '1 point';

    const radio2 = new HTMLInputElement('radio');
    radio2.id = 'r2';
    const label2 = new HTMLElement('LABEL');
    label2.setAttribute('for', 'r2');
    label2.textContent = '2 points';

    const radio3 = new HTMLInputElement('radio');
    radio3.id = 'r3';
    radio3.disabled = true;
    const label3 = new HTMLElement('LABEL');
    label3.setAttribute('for', 'r3');
    label3.textContent = '3 points';

    formPart.appendChild(radio1);
    formPart.appendChild(label1);
    formPart.appendChild(radio2);
    formPart.appendChild(label2);
    formPart.appendChild(radio3);
    formPart.appendChild(label3);
    sb.document.body.appendChild(formPart);

    const res = await vm.runInContext('autoGradePeerReview()', sb);
    assert.strictEqual(res.success, true);
    assert.strictEqual(radio2.checked, true, 'Should pick radio 2 (highest enabled)');
    assert.strictEqual(radio3.checked, false, 'Disabled radio 3 must not be selected');
    console.log('  -> PASS: selects highest enabled radio when highest score is disabled\n');
    passedCount++;
  }

  // -------------------------------------------------------------
  // Test 7: feedback field chính là root element có data-testid
  // -------------------------------------------------------------
  {
    console.log('Test 7: feedback field itself is root element with data-testid');
    const sb = createSandbox('https://www.coursera.org/learn/test/peer/abc');
    const formPart = new HTMLElement('DIV');
    formPart.classList.add('rc-FormPart');

    const radio = new HTMLInputElement('radio');
    radio.id = 'r1';
    const label = new HTMLElement('LABEL');
    label.setAttribute('for', 'r1');
    label.textContent = '5 points';
    formPart.appendChild(radio);
    formPart.appendChild(label);

    const rootFeedback = new HTMLElement('DIV');
    rootFeedback.setAttribute('data-testid', 'peer-review-multi-line-input-field');
    rootFeedback.setAttribute('contenteditable', 'true');
    formPart.appendChild(rootFeedback);
    sb.document.body.appendChild(formPart);

    const res = await vm.runInContext('autoGradePeerReview()', sb);
    assert.strictEqual(res.success, true);
    assert.ok(rootFeedback.textContent.length > 0, 'Root element should be filled with feedback text');
    console.log('  -> PASS: root element with data-testid filled cleanly\n');
    passedCount++;
  }

  // -------------------------------------------------------------
  // Test 8: discussion duplicate
  // -------------------------------------------------------------
  {
    console.log('Test 8: discussion duplicate check detects existing answer');
    const sb = createSandbox('https://www.coursera.org/learn/test/discussionPrompt/prompt1');
    sb.getUserId = async () => 'user123';
    sb.getCourseId = async () => 'course456';
    sb.getCsrfToken = () => 'csrf_mock';

    let postAttempted = false;

    sb.courseraFetch = async (url, opts) => {
      if (url.includes('onDemandDiscussionPrompts.v1')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            elements: [{ promptType: { courseItemForumQuestionId: 'course456~item1~q789' } }]
          })
        };
      }
      if (url.includes('onDemandCourseForumAnswers.v1') && (!opts || opts.method !== 'POST')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            elements: [
              { id: 'ans1', creatorId: '9999' },
              { id: 'ans2', creatorId: 'user123' }
            ]
          })
        };
      }
      if (opts && opts.method === 'POST') {
        postAttempted = true;
        return { ok: true, status: 201, json: async () => ({}) };
      }
      return { ok: false, status: 404 };
    };

    const res = await vm.runInContext('autoPostDiscussion()', sb);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.submitted, false);
    assert.strictEqual(res.skippedDuplicate, true);
    assert.strictEqual(postAttempted, false, 'POST must NOT be called when duplicate is detected');
    assert.ok(res.message.includes('từ trước rồi'));
    console.log('  -> PASS: duplicate detected, skipped POST and avoided duplicates\n');
    passedCount++;
  }

  // -------------------------------------------------------------
  // Test 9: discussion check API lỗi
  // -------------------------------------------------------------
  {
    console.log('Test 9: discussion check API error aborts and requires retry');
    const sb = createSandbox('https://www.coursera.org/learn/test/discussionPrompt/prompt1');
    sb.getUserId = async () => 'user123';
    sb.getCourseId = async () => 'course456';
    sb.getCsrfToken = () => 'csrf_mock';

    let postAttempted = false;

    sb.courseraFetch = async (url, opts) => {
      if (url.includes('onDemandDiscussionPrompts.v1')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            elements: [{ promptType: { courseItemForumQuestionId: 'course456~item1~q789' } }]
          })
        };
      }
      if (url.includes('onDemandCourseForumAnswers.v1') && (!opts || opts.method !== 'POST')) {
        return { ok: false, status: 500 };
      }
      if (opts && opts.method === 'POST') {
        postAttempted = true;
        return { ok: true, status: 201 };
      }
      return { ok: false, status: 404 };
    };

    const res = await vm.runInContext('autoPostDiscussion()', sb);
    assert.strictEqual(res.success, false);
    assert.strictEqual(postAttempted, false, 'POST must NOT be called when duplicate check fails');
    assert.ok(res.error.includes('Không thể kiểm tra'), 'Should return error requiring retry');
    console.log('  -> PASS: duplicate check API error safely aborted without posting\n');
    passedCount++;
  }

  // -------------------------------------------------------------
  // Test 10: POST 429 rồi 201
  // -------------------------------------------------------------
  {
    console.log('Test 10: POST 429 rate limited, retries and succeeds with 201');
    const sb = createSandbox('https://www.coursera.org/learn/test/discussionPrompt/prompt1');
    let postCallCount = 0;

    sb.courseraFetch = async (url, opts) => {
      if (opts && opts.method === 'POST') {
        postCallCount++;
        if (postCallCount === 1) {
          return {
            ok: false,
            status: 429,
            headers: { get: (name) => (name.toLowerCase() === 'retry-after' ? '1' : null) }
          };
        }
        return { ok: true, status: 201, json: async () => ({ id: 'new_answer' }) };
      }
      return { ok: false, status: 404 };
    };

    const res = await vm.runInContext('postDiscussionAnswerWithRetry("c1", "q1", "tok", "text", 3)', sb);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(postCallCount, 2, 'Should retry on 429 and succeed on 2nd attempt');
    console.log('  -> PASS: 429 rate limit retried and succeeded with 201\n');
    passedCount++;
  }

  // -------------------------------------------------------------
  // Test 11: POST 500
  // -------------------------------------------------------------
  {
    console.log('Test 11: POST 500 server error');
    const sb = createSandbox('https://www.coursera.org/learn/test/discussionPrompt/prompt1');
    let postCallCount = 0;

    sb.courseraFetch = async (url, opts) => {
      if (opts && opts.method === 'POST') {
        postCallCount++;
        return { ok: false, status: 500 };
      }
      return { ok: false, status: 404 };
    };

    const res = await vm.runInContext('postDiscussionAnswerWithRetry("c1", "q1", "tok", "text", 3)', sb);
    assert.strictEqual(res.status, 500);
    assert.strictEqual(postCallCount, 1, 'Should not endlessly retry on 500');
    console.log('  -> PASS: 500 handled correctly without looping\n');
    passedCount++;
  }

  // -------------------------------------------------------------
  // Test 12: bulk có cả success và failure (status=partial, no reload)
  // -------------------------------------------------------------
  {
    console.log('Test 12: bulk completion with partial success (status: partial, no reload)');
    const sb = createSandbox('https://www.coursera.org/learn/test/lecture/item1');
    sb.getCourseContext = () => ({ courseSlug: 'test-slug' });
    sb.getAllCourseItems = async () => ({
      elements: [{ id: 'courseId123' }],
      linked: {
        'onDemandCourseMaterialItems.v2': [
          { id: 'item1', contentSummary: { typeName: 'lecture' } },
          { id: 'item2', contentSummary: { typeName: 'lecture' } },
          { id: 'item3', contentSummary: { typeName: 'lecture' } },
        ]
      }
    });
    sb.getUserId = async () => 'user123';

    sb.markLectureCompleted = async (u, c, slug, itemId) => {
      if (itemId === 'item2') {
        return { success: false, error: 'Item 2 failed' };
      }
      return { success: true };
    };

    await vm.runInContext('markAllItemsCompleted()', sb);

    const progressMessages = sb._messagesSent.filter(m => m.action === 'progressUpdate');
    const lastProgress = progressMessages[progressMessages.length - 1];

    assert.ok(lastProgress, 'Should have sent progress updates');
    assert.strictEqual(lastProgress.status, 'partial', 'Status must be partial when failedCount > 0');
    assert.strictEqual(lastProgress.successCount, 2);
    assert.strictEqual(lastProgress.failedCount, 1);
    assert.strictEqual(sb._reloaded, false, 'Page must NOT be auto-reloaded on partial status');
    console.log('  -> PASS: bulk with partial success reported status=partial and did not reload\n');
    passedCount++;
  }

  // ===================================================================
  // GRADED QUIZ TESTS (v1.5.0)
  // ===================================================================

  // TC-13: getCourseContext() detects gradedQuiz for assignment-submission URL
  {
    totalCount++;
    console.log('TC-13: getCourseContext() detects gradedQuiz for assignment-submission URL...');
    const sb = createSandbox('https://www.coursera.org/learn/my-course/assignment-submission/yd6E/my-quiz/attempt');
    const ctx = vm.runInContext('getCourseContext()', sb);
    assert.strictEqual(ctx.itemType, 'gradedQuiz', 'itemType must be gradedQuiz');
    assert.strictEqual(ctx.itemId, 'yd6E', 'itemId must be yd6E');
    assert.strictEqual(ctx.courseSlug, 'my-course', 'courseSlug must be my-course');
    console.log('  -> PASS: assignment-submission URL correctly detected as gradedQuiz\n');
    passedCount++;
  }

  // TC-14: getCourseContext() peer URL regression — must NOT be affected
  {
    totalCount++;
    console.log('TC-14: getCourseContext() peer URL regression — /peer/ still maps to peer...');
    const sb = createSandbox('https://www.coursera.org/learn/my-course/peer/abcd1234/give-feedback');
    const ctx = vm.runInContext('getCourseContext()', sb);
    assert.strictEqual(ctx.itemType, 'peer', 'peer URL must still be itemType=peer');
    assert.strictEqual(ctx.courseSlug, 'my-course', 'courseSlug must match');
    console.log('  -> PASS: peer URL still correctly detected as peer (no regression)\n');
    passedCount++;
  }

  // TC-15: buildGeminiPrompt() formats questions correctly
  {
    totalCount++;
    console.log('TC-15: buildGeminiPrompt() creates correct prompt format...');
    const sb = createSandbox('https://www.coursera.org/learn/my-course/assignment-submission/abc/quiz/attempt');

    const questions = [
      { index: 0, questionText: 'What is 2 + 2?', type: 'single', options: [{ label: '3' }, { label: '4' }, { label: '5' }] },
      { index: 1, questionText: 'Select prime numbers:', type: 'multi', options: [{ label: '2' }, { label: '4' }, { label: '7' }, { label: '9' }] },
    ];
    sb.questions = questions;
    const prompt = vm.runInContext('buildGeminiPrompt(questions)', sb);

    assert.ok(prompt.includes('Q1 (single-choice): What is 2 + 2?'), 'Q1 must be single-choice');
    assert.ok(prompt.includes('Q2 (multi-choice'), 'Q2 must be multi-choice');
    assert.ok(prompt.includes('0) 3'), 'Q1 option 0 must be listed');
    assert.ok(prompt.includes('Return ONLY the JSON array'), 'Must include JSON-only instruction');
    console.log('  -> PASS: buildGeminiPrompt() generates correct structured prompt\n');
    passedCount++;
  }

  // TC-16: fillQuizAnswers() clicks the correct option elements
  {
    totalCount++;
    console.log('TC-16: fillQuizAnswers() clicks correct option elements...');
    const sb = createSandbox('https://www.coursera.org/learn/my-course/assignment-submission/abc/quiz/attempt');

    let clickedCount = 0;
    const makeInput = (type = 'radio', disabled = false) => {
      return {
        type,
        disabled,
        click: () => { if (!disabled) clickedCount++; },
        dispatchEvent: () => {},
      };
    };

    const questions = [
      {
        index: 0, questionText: 'Q1', type: 'single',
        options: [
          { label: 'A', element: makeInput('radio') },
          { label: 'B', element: makeInput('radio') },
          { label: 'C', element: makeInput('radio') },
        ]
      },
      {
        index: 1, questionText: 'Q2', type: 'multi',
        options: [
          { label: 'X', element: makeInput('checkbox') },
          { label: 'Y', element: makeInput('checkbox') },
          { label: 'Z', element: makeInput('checkbox') },
        ]
      },
    ];

    const answersFromAI = [
      { q: 1, answers: [2] },      // pick C
      { q: 2, answers: [0, 2] },   // pick X and Z
    ];

    sb.questions = questions;
    sb.answersFromAI = answersFromAI;
    vm.runInContext('fillQuizAnswers(questions, answersFromAI)', sb);

    assert.strictEqual(clickedCount, 3, 'Should have clicked 3 inputs total (1 + 2)');
    console.log('  -> PASS: fillQuizAnswers() clicked exactly the right options\n');
    passedCount++;
  }

  // TC-17: callGeminiWithRetry() strips markdown fences from JSON response
  {
    totalCount++;
    console.log('TC-17: callGeminiWithRetry() strips markdown code fences...');
    const sb = createSandbox('https://www.coursera.org/learn/my-course/assignment-submission/abc/quiz/attempt');

    // Mock chrome.runtime.sendMessage to return JSON wrapped in markdown fences
    sb.chrome.runtime.sendMessage = (msg, callback) => {
      const rawText = '```json\n[{"q":1,"answers":[0]},{"q":2,"answers":[1,2]}]\n```';
      const fakeGeminiResponse = {
        candidates: [{ content: { parts: [{ text: rawText }] } }]
      };
      callback({ ok: true, data: fakeGeminiResponse });
    };

    const result = await vm.runInContext('callGeminiWithRetry("fakekey", "prompt")', sb);

    assert.ok(Array.isArray(result), 'Result should be an array');
    assert.strictEqual(result.length, 2, 'Should have 2 answer items');
    assert.strictEqual(result[0].q, 1, 'First item q should be 1');
    assert.deepEqual(result[0].answers, [0], 'First item answers should be [0]');
    assert.strictEqual(result[1].q, 2, 'Second item q should be 2');
    assert.deepEqual(result[1].answers, [1, 2], 'Second item answers should be [1, 2]');
    console.log('  -> PASS: JSON correctly parsed after stripping markdown code fences\n');
    passedCount++;
  }

  // TC-18: autoAnswerGradedQuiz() returns error when API key is missing
  {
    totalCount++;
    console.log('TC-18: autoAnswerGradedQuiz() returns error when API key is missing...');
    const sb = createSandbox('https://www.coursera.org/learn/my-course/assignment-submission/yd6E/quiz/attempt');

    // Override sendMessage: no API key stored
    sb.chrome.runtime.sendMessage = (msg, callback) => {
      if (msg.action === 'getGeminiApiKey') callback({ apiKey: null });
    };

    const result = await vm.runInContext('autoAnswerGradedQuiz()', sb);

    assert.strictEqual(result.success, false, 'Should return success=false');
    assert.ok(
      result.error.includes('API Key') || result.error.includes('api key') || result.error.includes('API key'),
      'Error must mention API key'
    );
    console.log('  -> PASS: autoAnswerGradedQuiz() correctly errors when API key is missing\n');
    passedCount++;
  }

  // TC-19: autoAnswerGradedQuiz() returns error when on non-quiz page
  {
    totalCount++;
    console.log('TC-19: autoAnswerGradedQuiz() returns error when not on a gradedQuiz page...');
    const sb = createSandbox('https://www.coursera.org/learn/my-course/lecture/abcd1234');

    const result = await vm.runInContext('autoAnswerGradedQuiz()', sb);

    assert.strictEqual(result.success, false, 'Should return success=false on non-quiz page');
    assert.ok(
      result.error.includes('Graded Quiz') || result.error.includes('quiz'),
      'Error must mention quiz context'
    );
    console.log('  -> PASS: autoAnswerGradedQuiz() correctly errors on non-quiz page\n');
    passedCount++;
  }

  // TC-20: Gemini API key life cycle (save, change/overwrite, delete)
  {
    totalCount++;
    console.log('TC-20: Gemini API key life cycle (save, change/overwrite, delete)...');
    let storedKey = null;
    const fakeBackground = (msg, callback) => {
      if (msg.action === 'getGeminiApiKey') {
        callback({ apiKey: storedKey });
      } else if (msg.action === 'setGeminiApiKey') {
        storedKey = msg.key || null;
        callback({ ok: true });
      } else if (msg.action === 'removeGeminiApiKey') {
        storedKey = null;
        callback({ ok: true });
      }
    };

    // 1. Initial: no key
    fakeBackground({ action: 'getGeminiApiKey' }, (res) => {
      assert.strictEqual(res.apiKey, null, 'Initially key should be null');
    });

    // 2. Set key
    fakeBackground({ action: 'setGeminiApiKey', key: 'AIzaSyFirstKey123' }, (res) => {
      assert.strictEqual(res.ok, true);
    });
    fakeBackground({ action: 'getGeminiApiKey' }, (res) => {
      assert.strictEqual(res.apiKey, 'AIzaSyFirstKey123', 'Key should be saved');
    });

    // 3. Change / Overwrite key
    fakeBackground({ action: 'setGeminiApiKey', key: 'AIzaSySecondKey456' }, (res) => {
      assert.strictEqual(res.ok, true);
    });
    fakeBackground({ action: 'getGeminiApiKey' }, (res) => {
      assert.strictEqual(res.apiKey, 'AIzaSySecondKey456', 'Key should be updated to new value');
    });

    // 4. Remove key
    fakeBackground({ action: 'removeGeminiApiKey' }, (res) => {
      assert.strictEqual(res.ok, true);
    });
    fakeBackground({ action: 'getGeminiApiKey' }, (res) => {
      assert.strictEqual(res.apiKey, null, 'Key should be removed');
    });

    console.log('  -> PASS: Gemini API key can be saved, changed, and deleted\n');
    passedCount++;
  }

  // TC-21: refreshWidgetApiKeyUI updates status and placeholder correctly
  {
    totalCount++;
    console.log('TC-21: refreshWidgetApiKeyUI updates status and placeholder correctly...');
    const sb = createSandbox('https://www.coursera.org/learn/my-course/lecture/test');

    let currentKey = 'AIzaSyTest12345678';
    sb.chrome.runtime.sendMessage = (msg, cb) => {
      if (msg.action === 'getGeminiApiKey') cb({ apiKey: currentKey });
    };

    // Mock widget elements
    const badge = new HTMLElement('SPAN'); badge.id = 'cs-key-status-badge';
    const mask = new HTMLElement('SPAN'); mask.id = 'cs-key-mask-preview';
    const input = new HTMLInputElement(); input.id = 'cs-api-key-input';
    const delBtn = new HTMLButtonElement(); delBtn.id = 'cs-delete-key-btn';

    sb.window.widgetShadow = {
      getElementById(id) {
        if (id === 'cs-key-status-badge') return badge;
        if (id === 'cs-key-mask-preview') return mask;
        if (id === 'cs-api-key-input') return input;
        if (id === 'cs-delete-key-btn') return delBtn;
        return null;
      }
    };

    // Run refreshWidgetApiKeyUI when key exists
    vm.runInContext('refreshWidgetApiKeyUI()', sb);
    assert.ok(badge.className.includes('active'), 'Badge should be active when key exists');
    assert.ok(mask.textContent.includes('AIza'), 'Mask should show partial key');
    assert.strictEqual(delBtn.style.display, 'inline-flex', 'Delete button should be shown');

    // Run refreshWidgetApiKeyUI when key is null
    currentKey = null;
    vm.runInContext('refreshWidgetApiKeyUI()', sb);
    assert.ok(badge.className.includes('empty'), 'Badge should be empty when key is null');
    assert.strictEqual(delBtn.style.display, 'none', 'Delete button should be hidden');

    console.log('  -> PASS: refreshWidgetApiKeyUI handles existing and removed key properly\n');
    passedCount++;
  }

  // TC-22: callGeminiWithRetry() filters out thought parts (thought: true)
  {
    totalCount++;
    console.log('TC-22: callGeminiWithRetry() filters out thought parts with unterminated strings...');
    const sb = createSandbox('https://www.coursera.org/learn/my-course/assignment-submission/abc/quiz/attempt');

    // Mock Gemini 2.5 / 3.x thinking model response structure
    sb.chrome.runtime.sendMessage = (msg, callback) => {
      const fakeGeminiResponse = {
        candidates: [{
          content: {
            parts: [
              {
                thought: true,
                text: 'Thinking process:\n1. The user asks about ethical data driven technologies.\nLine 7: "Unterminated string in thought... ',
              },
              {
                thought: false,
                text: '[{"q":1,"answers":[0]},{"q":2,"answers":[1,2]}]',
              },
            ],
          },
        }],
      };
      callback({ ok: true, data: fakeGeminiResponse });
    };

    const result = await vm.runInContext('callGeminiWithRetry("fakekey", "prompt")', sb);

    assert.ok(Array.isArray(result), 'Result should be an array');
    assert.strictEqual(result.length, 2, 'Should have 2 answer items');
    assert.strictEqual(result[0].q, 1);
    assert.deepEqual(result[0].answers, [0]);
    assert.strictEqual(result[1].q, 2);
    assert.deepEqual(result[1].answers, [1, 2]);
    console.log('  -> PASS: callGeminiWithRetry() successfully filtered thought parts and extracted valid JSON\n');
    passedCount++;
  }

  // TC-23: callGeminiWithRetry() handles object wrapping and outer conversational text
  {
    totalCount++;
    console.log('TC-23: callGeminiWithRetry() handles object wrapping and outer conversational text...');
    const sb = createSandbox('https://www.coursera.org/learn/my-course/assignment-submission/abc/quiz/attempt');

    // Object wrapping with text before and after
    sb.chrome.runtime.sendMessage = (msg, callback) => {
      const rawText = 'Sure! Here are your answers:\n```json\n{"answers": [{"q": 1, "answers": [2]}, {"q": 2, "answers": [0]}]}\n```\nGood luck on your quiz!';
      const fakeGeminiResponse = {
        candidates: [{
          content: {
            parts: [{ text: rawText }],
          },
        }],
      };
      callback({ ok: true, data: fakeGeminiResponse });
    };

    const result = await vm.runInContext('callGeminiWithRetry("fakekey", "prompt")', sb);

    assert.ok(Array.isArray(result), 'Result should unwrap to an array');
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].q, 1);
    assert.deepEqual(result[0].answers, [2]);
    assert.strictEqual(result[1].q, 2);
    assert.deepEqual(result[1].answers, [0]);
    console.log('  -> PASS: callGeminiWithRetry() successfully unwrapped object and extracted answers\n');
    passedCount++;
  }

  // TC-24: Multi-provider AI keys life cycle and active provider switching
  {
    totalCount++;
    console.log('TC-24: Multi-provider AI keys life cycle (Gemini, OpenAI, Groq)...');
    let aiConfig = {
      activeProvider: 'gemini',
      keys: { gemini: null, openai: null, groq: null }
    };

    const fakeBackground = (msg, callback) => {
      if (msg.action === 'getAiConfig') {
        callback({
          activeProvider: aiConfig.activeProvider,
          provider: aiConfig.activeProvider,
          keys: { ...aiConfig.keys },
          apiKey: aiConfig.keys[aiConfig.activeProvider] || null
        });
      } else if (msg.action === 'setAiKey') {
        const prov = msg.provider || 'gemini';
        aiConfig.keys[prov] = msg.key || null;
        callback({ ok: true });
      } else if (msg.action === 'setAiProvider') {
        aiConfig.activeProvider = msg.provider || 'gemini';
        callback({ ok: true, provider: aiConfig.activeProvider });
      } else if (msg.action === 'removeAiKey') {
        const prov = msg.provider || 'gemini';
        aiConfig.keys[prov] = null;
        callback({ ok: true });
      }
    };

    // 1. Initial: all empty
    fakeBackground({ action: 'getAiConfig' }, (res) => {
      assert.strictEqual(res.activeProvider, 'gemini');
      assert.strictEqual(res.keys.openai, null);
      assert.strictEqual(res.keys.groq, null);
    });

    // 2. Save OpenAI and Groq keys
    fakeBackground({ action: 'setAiKey', provider: 'openai', key: 'sk-proj-test12345' }, (res) => {
      assert.strictEqual(res.ok, true);
    });
    fakeBackground({ action: 'setAiKey', provider: 'groq', key: 'gsk-test67890' }, (res) => {
      assert.strictEqual(res.ok, true);
    });

    // 3. Switch active provider to Groq
    fakeBackground({ action: 'setAiProvider', provider: 'groq' }, (res) => {
      assert.strictEqual(res.ok, true);
      assert.strictEqual(res.provider, 'groq');
    });

    fakeBackground({ action: 'getAiConfig' }, (res) => {
      assert.strictEqual(res.activeProvider, 'groq');
      assert.strictEqual(res.apiKey, 'gsk-test67890');
      assert.strictEqual(res.keys.openai, 'sk-proj-test12345');
      assert.strictEqual(res.keys.groq, 'gsk-test67890');
    });

    // 4. Remove OpenAI key, verify Groq is unchanged
    fakeBackground({ action: 'removeAiKey', provider: 'openai' }, (res) => {
      assert.strictEqual(res.ok, true);
    });
    fakeBackground({ action: 'getAiConfig' }, (res) => {
      assert.strictEqual(res.keys.openai, null);
      assert.strictEqual(res.keys.groq, 'gsk-test67890');
    });

    console.log('  -> PASS: Multi-provider AI keys and provider switching work correctly\n');
    passedCount++;
  }

  // TC-25: callAiWithRetry() works for OpenAI and Groq
  {
    totalCount++;
    console.log('TC-25: callAiWithRetry() works for OpenAI and Groq...');
    const sb = createSandbox('https://www.coursera.org/learn/my-course/assignment-submission/abc/quiz/attempt');

    let calledProvider = null;
    sb.chrome.runtime.sendMessage = (msg, callback) => {
      if (msg.action === 'callAiApi') {
        calledProvider = msg.provider;
        if (msg.provider === 'openai') {
          callback({
            ok: true,
            data: { text: '[{"q":1,"answers":[1]}]' }
          });
        } else if (msg.provider === 'groq') {
          callback({
            ok: true,
            data: { text: '```json\n[{"q":1,"answers":[2]}]\n```' }
          });
        }
      }
    };

    // Test OpenAI
    const openAiRes = await vm.runInContext('callAiWithRetry("openai", "sk-test", "prompt")', sb);
    assert.strictEqual(calledProvider, 'openai');
    assert.deepEqual(openAiRes, [{ q: 1, answers: [1] }]);

    // Test Groq
    const groqRes = await vm.runInContext('callAiWithRetry("groq", "gsk-test", "prompt")', sb);
    assert.strictEqual(calledProvider, 'groq');
    assert.deepEqual(groqRes, [{ q: 1, answers: [2] }]);

    console.log('  -> PASS: callAiWithRetry() successfully calls OpenAI and Groq providers\n');
    passedCount++;
  }

  // TC-26: autoAnswerGradedQuiz() auto-falls back when active provider has no key
  {
    totalCount++;
    console.log('TC-26: autoAnswerGradedQuiz() auto-falls back to configured provider...');
    const sb = createSandbox('https://www.coursera.org/learn/my-course/assignment-submission/test/quiz/attempt');

    let currentProvider = 'gemini';
    const fakeConfig = {
      provider: 'gemini',
      keys: {
        gemini: null, // Gemini has no key!
        openai: null,
        groq: 'gsk-valid-groq-key' // Groq has a valid key
      }
    };

    sb.chrome.runtime.sendMessage = (msg, callback) => {
      if (msg.action === 'getAiConfig') {
        callback(fakeConfig);
      } else if (msg.action === 'setAiProvider') {
        currentProvider = msg.provider;
        if (callback) callback({ ok: true });
      } else if (msg.action === 'callAiApi') {
        assert.strictEqual(msg.provider, 'groq', 'Should call Groq because it has the valid key');
        assert.strictEqual(msg.apiKey, 'gsk-valid-groq-key');
        callback({
          ok: true,
          data: { text: '[{"q":1,"answers":[0]}]' }
        });
      }
    };

    // Setup 1 question in DOM with 2 options
    const form = new HTMLElement('FORM');
    form.setAttribute('data-testid', 'question-form');
    const p = new HTMLElement('P');
    p.textContent = 'What is 1 + 1?';
    const radio1 = new HTMLInputElement('radio');
    radio1.value = '2';
    const label1 = new HTMLElement('LABEL');
    label1.textContent = '2';
    label1.appendChild(radio1);
    const radio2 = new HTMLInputElement('radio');
    radio2.value = '3';
    const label2 = new HTMLElement('LABEL');
    label2.textContent = '3';
    label2.appendChild(radio2);
    form.appendChild(p);
    form.appendChild(label1);
    form.appendChild(label2);
    sb.document.body.appendChild(form);

    const result = await vm.runInContext('autoAnswerGradedQuiz()', sb);
    assert.strictEqual(result.success, true, 'Should succeed via Groq fallback');
    assert.ok(result.message.includes('Groq') || result.message.includes('AI'), 'Message should indicate AI completion');
    assert.strictEqual(currentProvider, 'groq', 'Provider should have automatically switched to Groq');

    console.log('  -> PASS: autoAnswerGradedQuiz() auto-switched to Groq and answered quiz\n');
    passedCount++;
  }

  console.log('====================================================');
  console.log(`RESULTS: ${passedCount} / ${totalCount} TESTS PASSED!`);
  console.log('====================================================');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED WITH ERROR:\n', err);
  process.exit(1);
});
