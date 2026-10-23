import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { getInkColorForSender, USER_INK_PALETTE, PAGE_GLOW_ENABLED, PAGE_GLOW_IN_ROOM, INK_COLORS } from '../theme/tokens';

test('Button: renders accessible variants and attributes', () => {
  const htmlPrimary = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Button, { variant: 'primary' }, 'Enter Pool')
  );
  assert.ok(htmlPrimary.includes('Enter Pool'), 'Renders button label');
  assert.ok(htmlPrimary.includes('bg-ink-indigo'), 'Primary button uses bg-ink-indigo');
  assert.ok(htmlPrimary.includes('focus-visible:ring-2'), 'Has 2px visible focus ring');

  const htmlDisabled = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Button, { disabled: true }, 'Disabled Action')
  );
  assert.ok(htmlDisabled.includes('disabled=""') || htmlDisabled.includes('disabled'), 'Has disabled attribute');
  assert.ok(htmlDisabled.includes('disabled:opacity-40'), 'Has disabled opacity class');

  const htmlLoading = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Button, { isLoading: true }, 'Saving')
  );
  assert.ok(htmlLoading.includes('animate-spin'), 'Renders loading spinner');
});

test('Input: renders label, helper text, counter, and error states', () => {
  const htmlWithError = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Input, {
      label: 'Pool Title',
      error: 'Title is required',
      value: '',
      readOnly: true,
      maxLength: 40,
      showCounter: true,
      currentLength: 0,
    })
  );
  assert.ok(htmlWithError.includes('Pool Title'), 'Renders input label');
  assert.ok(htmlWithError.includes('role="alert"'), 'Error is announced with role="alert"');
  assert.ok(htmlWithError.includes('Title is required'), 'Renders error message');
  assert.ok(htmlWithError.includes('aria-invalid="true"'), 'Sets aria-invalid="true"');
  assert.ok(htmlWithError.includes('0 / 40'), 'Renders character counter');
  assert.ok(htmlWithError.toLowerCase().includes('autocomplete="off"'), 'Defaults autocomplete to off');
});

test('Textarea: renders auto-growing textarea attributes', () => {
  const htmlTextarea = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Textarea, {
      label: 'Message',
      maxLength: 1000,
      currentLength: 150,
      showCounter: true,
    })
  );
  assert.ok(htmlTextarea.includes('<textarea'), 'Renders textarea element');
  assert.ok(htmlTextarea.includes('150 / 1000'), 'Renders current length against max');
});

test('Badge: renders semantic variants and clean contrast', () => {
  const htmlTeal = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Badge, { variant: 'teal' }, 'open')
  );
  assert.ok(htmlTeal.includes('text-teal-600 dark:text-ink-teal'), 'Uses contrast-safe color classes');

  const htmlRose = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Badge, { variant: 'rose' }, 'locked')
  );
  assert.ok(htmlRose.includes('text-rose-600 dark:text-ink-rose'), 'Uses rose color classes');
});

test('getInkColorForSender: returns deterministic stable colors from palette', () => {
  const color1 = getInkColorForSender('Alice');
  const color2 = getInkColorForSender('Alice');
  assert.deepEqual(color1, color2, 'Same username produces identical color');

  const color3 = getInkColorForSender('Bob');
  assert.ok(USER_INK_PALETTE.includes(color3 as any), 'Assigned color is within valid palette');
});

test('PageCursorGlow: verifies effect configuration and theme tokens', () => {
  assert.equal(PAGE_GLOW_ENABLED, true, 'PAGE_GLOW_ENABLED defaults to true');
  assert.equal(PAGE_GLOW_IN_ROOM, false, 'PAGE_GLOW_IN_ROOM defaults to false');
  assert.equal(INK_COLORS.glowPageCore, 'var(--glow-page-core)', 'Core glow token bound');
  assert.equal(INK_COLORS.glowPageEdge, 'var(--glow-page-edge)', 'Edge glow token bound');
});
