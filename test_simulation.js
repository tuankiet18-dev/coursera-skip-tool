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
const totalCount = 12;

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

  console.log('====================================================');
  console.log(`RESULTS: ${passedCount} / ${totalCount} TESTS PASSED!`);
  console.log('====================================================');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED WITH ERROR:\n', err);
  process.exit(1);
});
