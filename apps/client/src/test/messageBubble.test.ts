import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import {
  MessageBubble,
  hasVisibleContent,
  protectMaskRuns,
  formatCensoredText,
} from '../components/MessageBubble';
import { ChatMessage } from '../types';

test('hasVisibleContent: accurately detects text and censor masks vs empty content', () => {
  // Masks are valid visible content
  assert.equal(hasVisibleContent('****'), true);
  assert.equal(hasVisibleContent('***'), true);
  assert.equal(hasVisibleContent('*****'), true);
  assert.equal(hasVisibleContent('you are **** idiot'), true);

  // Normal markdown and text
  assert.equal(hasVisibleContent('hello world'), true);
  assert.equal(hasVisibleContent('**bold**'), true);
  assert.equal(hasVisibleContent('*italic*'), true);
  assert.equal(hasVisibleContent('`code`'), true);

  // Whitespace and empty markdown scaffolding
  assert.equal(hasVisibleContent(''), false);
  assert.equal(hasVisibleContent('   '), false);
  assert.equal(hasVisibleContent('\n\n\t  '), false);
  assert.equal(hasVisibleContent('** **'), false);
  assert.equal(hasVisibleContent('```\n```'), false);
  assert.equal(hasVisibleContent(undefined), false);
});

test('protectMaskRuns: escapes standalone asterisks to prevent <hr> and formatting collapse', () => {
  // Standalone asterisks
  assert.equal(protectMaskRuns('****'), '\\*\\*\\*\\*');
  assert.equal(protectMaskRuns('***'), '\\*\\*\\*');
  assert.equal(protectMaskRuns('*****'), '\\*\\*\\*\\*\\*');

  // Mixed messages
  assert.equal(protectMaskRuns('you are **** idiot'), 'you are \\*\\*\\*\\* idiot');
  assert.equal(protectMaskRuns('you are *** idiot'), 'you are \\*\\*\\* idiot');

  // Real markdown remains intact
  assert.equal(protectMaskRuns('**bold**'), '**bold**');
  assert.equal(protectMaskRuns('*italic*'), '*italic*');
  assert.equal(protectMaskRuns('***bold italic***'), '***bold italic***');
  assert.equal(protectMaskRuns('`regular inline code`'), '`regular inline code`');

  // Code blocks are not altered with backslashes
  assert.equal(protectMaskRuns('`****`'), '`****`');
  assert.equal(protectMaskRuns('```\nconst x = "****";\n```'), '```\nconst x = "****";\n```');
});

test('MessageBubble: renders visible masked badge for standalone banned word', () => {
  const message: ChatMessage = {
    id: 'msg_1',
    sender: 'Alice',
    text: '****',
    timestamp: Date.now(),
  };

  const htmlOwn = ReactDOMServer.renderToStaticMarkup(
    React.createElement(MessageBubble, { message, isOwn: true })
  );
  assert.ok(htmlOwn.includes('****'), 'Own bubble must contain visible ****');
  assert.ok(htmlOwn.includes('font-mono'), 'Mask must use font-mono styling');
  assert.ok(htmlOwn.includes('data-censored="true"'), 'Mask badge must be marked data-censored');
  assert.ok(!htmlOwn.includes('<hr'), 'Must not render as <hr>');

  const htmlOther = ReactDOMServer.renderToStaticMarkup(
    React.createElement(MessageBubble, { message, isOwn: false })
  );
  assert.ok(htmlOther.includes('****'), 'Other bubble must contain visible ****');
  assert.ok(htmlOther.includes('font-mono'), 'Other mask must use font-mono styling');
});

test('MessageBubble: renders visible masked badge for mixed sentence', () => {
  const message: ChatMessage = {
    id: 'msg_2',
    sender: 'Bob',
    text: 'you are **** idiot',
    timestamp: Date.now(),
  };

  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(MessageBubble, { message, isOwn: false })
  );
  assert.ok(html.includes('you are '), 'Preceding text must be rendered');
  assert.ok(html.includes('****'), 'Masked word must be rendered');
  assert.ok(html.includes(' idiot'), 'Succeeding text must be rendered');
});

test('MessageBubble: banned word inside inline code or code block displays mask', () => {
  const messageInline: ChatMessage = {
    id: 'msg_3',
    sender: 'Bob',
    text: 'Check `****` now',
    timestamp: Date.now(),
  };

  const htmlInline = ReactDOMServer.renderToStaticMarkup(
    React.createElement(MessageBubble, { message: messageInline, isOwn: false })
  );
  assert.ok(htmlInline.includes('<code'), 'Inline code element must be present');
  assert.ok(htmlInline.includes('****'), 'Mask must be present inside code');

  const messageBlock: ChatMessage = {
    id: 'msg_4',
    sender: 'Bob',
    text: '```\nconst bad = "****";\n```',
    timestamp: Date.now(),
  };

  const htmlBlock = ReactDOMServer.renderToStaticMarkup(
    React.createElement(MessageBubble, { message: messageBlock, isOwn: false })
  );
  assert.ok(htmlBlock.includes('<pre'), 'Fenced pre block must be present');
  assert.ok(htmlBlock.includes('****'), 'Mask must be present inside fenced code');
});

test('MessageBubble: preserves legitimate Markdown formatting', () => {
  const message: ChatMessage = {
    id: 'msg_5',
    sender: 'Alice',
    text: '**bold** and *italic* and `code`',
    timestamp: Date.now(),
  };

  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(MessageBubble, { message, isOwn: true })
  );
  assert.ok(html.includes('<strong>bold</strong>'), 'Bold markdown must be rendered');
  assert.ok(html.includes('<em>italic</em>'), 'Italic markdown must be rendered');
  assert.ok(html.includes('code'), 'Inline code must be rendered');
});

test('MessageBubble: empty-render fallback shows [message removed] in italics and never a blank bubble', () => {
  const emptyMessage: ChatMessage = {
    id: 'msg_6',
    sender: 'Alice',
    text: '   ',
    timestamp: Date.now(),
  };

  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(MessageBubble, { message: emptyMessage, isOwn: true })
  );
  assert.ok(html.includes('[message removed]'), 'Must show [message removed] placeholder');
  assert.ok(html.includes('italic'), 'Placeholder must be styled in italics');
});

test('MessageBubble: image message with censored caption formats mask', () => {
  const imgMessage: ChatMessage = {
    id: 'msg_7',
    sender: 'Alice',
    text: 'Drop **** yeah!',
    caption: 'Drop **** yeah!',
    messageType: 'image',
    imageDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    timestamp: Date.now(),
  };

  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(MessageBubble, { message: imgMessage, isOwn: false })
  );
  assert.ok(html.includes('<img'), 'Image tag must be rendered');
  assert.ok(html.includes('****'), 'Caption mask must be rendered');
  assert.ok(html.includes('data-censored="true"'), 'Caption mask badge must be rendered');
});
